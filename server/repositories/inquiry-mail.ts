// 负责咨询邮件的数据库查询与持久化，使用调用方传入的执行器，不决定 HTTP 响应或业务授权。
import {and, asc, desc, eq, inArray, isNull, lte} from 'drizzle-orm'
import type {InquiryMailKind, InquiryMailResolution} from '#shared/schemas/admin/inquiry-settings'
import {withEntityIds} from '../db/allocate-entity-id'
import {customerInquiryMail as mail} from '../db/schema'
import type {DatabaseExecutor} from '../db/transaction'

export const inquiryMailRepository = {
    enqueue: async (db: DatabaseExecutor, data: typeof mail.$inferInsert) => {
        const row = await withEntityIds(db, 'customer_inquiry_mail', {createdAt: new Date(), ...data})
        await db.insert(mail).values(row)
        return row.id
    },
    history: (db: DatabaseExecutor, inquiryId: bigint) =>
        db.select().from(mail).where(eq(mail.inquiryId, inquiryId)).orderBy(desc(mail.id)).limit(100),
    async retry(db: DatabaseExecutor, inquiryId: bigint, id: bigint, kinds: InquiryMailKind[], now: Date) {
        if (!kinds.length) return false
        const [result] = await db.update(mail).set({status: 'queued', attempts: 0, availableAt: now})
            .where(and(eq(mail.id, id), eq(mail.inquiryId, inquiryId), eq(mail.status, 'failed'), isNull(mail.resolution), inArray(mail.kind, kinds)))
        return result.affectedRows === 1
    },
    async closeIssue(db: DatabaseExecutor, inquiryId: bigint, id: bigint, resolution: InquiryMailResolution) {
        const [result] = await db.update(mail).set({resolution})
            .where(and(eq(mail.id, id), eq(mail.inquiryId, inquiryId), isNull(mail.resolution), inArray(mail.status, ['failed', 'uncertain'])))
        return result.affectedRows === 1
    },
    expire: (db: DatabaseExecutor, now: Date) => db.update(mail).set({status: 'uncertain'})
        .where(and(eq(mail.status, 'sending'), lte(mail.availableAt, now))),
    async claim(db: DatabaseExecutor, now: Date, kinds: InquiryMailKind[]) {
        if (!kinds.length) return undefined
        const [row] = await db.select().from(mail)
            .where(and(eq(mail.status, 'queued'), inArray(mail.kind, kinds), lte(mail.availableAt, now)))
            .orderBy(asc(mail.availableAt), asc(mail.id)).limit(1).for('update', {skipLocked: true})
        if (!row) return undefined
        const attempts = row.attempts + 1
        await db.update(mail).set({status: 'sending', attempts, availableAt: new Date(now.getTime() + 300_000)}).where(eq(mail.id, row.id))
        return {...row, attempts}
    },
    finish: (db: DatabaseExecutor, id: bigint, attempts: number, values: Pick<typeof mail.$inferInsert, 'status' | 'availableAt' | 'sentAt'>) =>
        db.update(mail).set(values).where(and(eq(mail.id, id), eq(mail.attempts, attempts), eq(mail.status, 'sending'))),
}
