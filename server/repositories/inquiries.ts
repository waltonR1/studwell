// 负责咨询的数据库查询与持久化，使用调用方传入的执行器，不决定 HTTP 响应或业务授权。
import {and, asc, count, desc, eq, exists, gt, gte, inArray, isNull, lt, or, sql} from 'drizzle-orm'
import type {InquiryListQuery} from '#shared/schemas/admin/inquiries'
import {isEntityIdInRange} from '#shared/schemas/entity'
import {withEntityIds} from '../db/allocate-entity-id'
import {adminUsers, adminUserRoles, adminRoles, adminRolePermissions, adminPermissions, customerInquiries as inquiries, customerInquiryEvents as events, customerInquiryMail as mail} from '../db/schema'
import type {DatabaseExecutor} from '../db/transaction'

export const inquiryRead = 'content.inquiries.read'
export const inquiryManage = 'content.inquiries.update'
export const inquiryAssign = 'content.inquiries.assign'
export const inquirySend = 'content.inquiries.mail.send'
export type InquiryRow = typeof inquiries.$inferSelect

// For the inbox, only customer replies accepted by SMTP and actual follow-up actions count.
const followUpTime = sql`greatest(
    coalesce(unix_timestamp((select max(${events.createdAt}) from ${events}
        where ${events.inquiryId} = ${inquiries.id} and ${events.action} in ('update', 'note', 'external_reply'))), 0),
    coalesce(unix_timestamp((select max(${mail.sentAt}) from ${mail}
        where ${mail.inquiryId} = ${inquiries.id} and ${mail.kind} = 'reply' and ${mail.status} = 'sent')), 0)
)`.mapWith(value => Number(value) > 0 ? new Date(Number(value) * 1000) : null)

const joined = (db: DatabaseExecutor) => db.select({row: inquiries, assigneeName: adminUsers.displayName, lastFollowUpAt: followUpTime})
    .from(inquiries).leftJoin(adminUsers, eq(adminUsers.id, inquiries.assigneeId))
const startOfDay = (day: string) => new Date(day + 'T00:00:00+08:00')

export const inquiryRepository = {
    async submit(db: DatabaseExecutor, value: typeof inquiries.$inferInsert) {
        const row = await withEntityIds(db, 'customer_inquiries', value)
        await db.insert(inquiries).values(row).onDuplicateKeyUpdate({set: {id: sql`${inquiries.id}`}})
        const stored = (await db.select().from(inquiries).where(eq(inquiries.submissionKey, row.submissionKey)).for('update'))[0]!
        return {stored, inserted: stored.id === row.id}
    },
    async list(db: DatabaseExecutor, query: InquiryListQuery, actor: bigint) {
        const issue = exists(db.select({id: mail.id}).from(mail).where(and(eq(mail.inquiryId, inquiries.id), isNull(mail.resolution), inArray(mail.status, ['failed', 'uncertain']))))
        const open = inArray(inquiries.status, ['pending', 'awaiting_reply', 'in_progress', 'waiting_customer'])
        const search = query.search
        const filter = and(
            query.status ? eq(inquiries.status, query.status) : undefined,
            query.category ? eq(inquiries.category, query.category) : undefined,
            query.queue === 'mine' ? and(open, eq(inquiries.assigneeId, actor)) : undefined,
            query.queue === 'mine_reply' ? and(inArray(inquiries.status, ['pending', 'awaiting_reply']), eq(inquiries.assigneeId, actor)) : undefined,
            query.queue === 'unassigned' ? and(open, isNull(inquiries.assigneeId)) : undefined,
            query.queue === 'delivery_issue' ? issue : undefined,
            query.assigneeId ? eq(inquiries.assigneeId, BigInt(query.assigneeId)) : undefined,
            search ? (isEntityIdInRange(search) ? eq(inquiries.id, BigInt(search)) : sql`locate(${search}, ${inquiries.email}) > 0`) : undefined,
            query.from ? gte(inquiries.createdAt, startOfDay(query.from)) : undefined,
            query.to ? lt(inquiries.createdAt, new Date(startOfDay(query.to).getTime() + 86_400_000)) : undefined,
        )
        const [{total} = {total: 0}] = await db.select({total: count()}).from(inquiries).where(filter)
        const rows = await db.select({
            id: inquiries.id, name: inquiries.name, category: inquiries.category, status: inquiries.status,
            assigneeId: inquiries.assigneeId, assigneeName: adminUsers.displayName, createdAt: inquiries.createdAt, lastFollowUpAt: followUpTime,
            // The driver can return EXISTS as "0" or "1" with bigNumberStrings enabled.
            deliveryIssue: issue.mapWith(value => Number(value) === 1),
        }).from(inquiries).leftJoin(adminUsers, eq(adminUsers.id, inquiries.assigneeId))
            .where(filter).orderBy(...(query.queue === 'mine_reply'
                ? [asc(sql`coalesce(nullif(${followUpTime}, 0), unix_timestamp(${inquiries.createdAt}))`), asc(inquiries.id)]
                : [desc(inquiries.id)])).limit(query.pageSize).offset((query.page - 1) * query.pageSize)
        return {rows, total}
    },
    assigneeFilters(db: DatabaseExecutor) {
        return db.selectDistinct({id: adminUsers.id, name: adminUsers.displayName}).from(inquiries)
            .innerJoin(adminUsers, eq(adminUsers.id, inquiries.assigneeId)).orderBy(asc(adminUsers.displayName), asc(adminUsers.id))
    },
    async get(db: DatabaseExecutor, id: bigint) {
        return (await joined(db).where(eq(inquiries.id, id)))[0]
    },
    async latestReplyCycle(db: DatabaseExecutor, id: bigint): Promise<bigint | null> {
        const [cycle] = await db.select({id: events.id}).from(events)
            .where(and(eq(events.inquiryId, id), eq(events.action, 'update'), eq(events.status, 'awaiting_reply')))
            .orderBy(desc(events.id)).limit(1)
        return cycle?.id ?? null
    },
    async hasConfirmedReply(db: DatabaseExecutor, id: bigint): Promise<boolean> {
        const cycleId = await inquiryRepository.latestReplyCycle(db, id)
        const [external] = await db.select({id: events.id}).from(events)
            .where(and(eq(events.inquiryId, id), eq(events.action, 'external_reply'), cycleId === null ? undefined : gt(events.id, cycleId))).limit(1)
        if (external) return true
        // A previously queued message must not close a newer reply cycle.
        const [accepted] = await db.select({id: mail.id}).from(mail)
            .where(and(eq(mail.inquiryId, id), eq(mail.kind, 'reply'), eq(mail.status, 'sent'), cycleId === null ? undefined : eq(mail.replyCycleId, cycleId))).limit(1)
        return !!accepted
    },
    async lock(db: DatabaseExecutor, id: bigint) {
        return (await db.select().from(inquiries).where(eq(inquiries.id, id)).for('update'))[0]
    },
    update(db: DatabaseExecutor, id: bigint, value: Pick<InquiryRow, 'status' | 'assigneeId' | 'version'>) {
        return db.update(inquiries).set(value).where(eq(inquiries.id, id))
    },
    async append(db: DatabaseExecutor, value: typeof events.$inferInsert) {
        await db.insert(events).values(await withEntityIds(db, 'customer_inquiry_events', {createdAt: new Date(), ...value}))
    },
    history(db: DatabaseExecutor, id: bigint) {
        return db.select().from(events).where(eq(events.inquiryId, id)).orderBy(desc(events.id)).limit(100)
    },
    assignees(db: DatabaseExecutor, id?: bigint) {
        const eligible = db.select({id: adminUserRoles.userId}).from(adminUserRoles)
            .innerJoin(adminRoles, eq(adminRoles.id, adminUserRoles.roleId))
            .innerJoin(adminRolePermissions, eq(adminRolePermissions.roleId, adminRoles.id))
            .innerJoin(adminPermissions, eq(adminPermissions.id, adminRolePermissions.permissionId))
            .where(and(eq(adminRoles.enabled, true), eq(adminPermissions.available, true), inArray(adminPermissions.code, [inquiryRead, inquiryManage])))
            .groupBy(adminUserRoles.userId).having(sql`count(distinct ${adminPermissions.code}) = 2`)
        return db.select({id: adminUsers.id, name: adminUsers.displayName, email: adminUsers.email}).from(adminUsers)
            .where(and(eq(adminUsers.enabled, true), isNull(adminUsers.deletedAt),
                or(eq(adminUsers.isRoot, true), inArray(adminUsers.id, eligible)), id === undefined ? undefined : eq(adminUsers.id, id)))
            .orderBy(asc(adminUsers.displayName), asc(adminUsers.id))
    },
}
