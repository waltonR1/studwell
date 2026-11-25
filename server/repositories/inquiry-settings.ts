// 负责咨询设置的数据库查询与持久化，使用调用方传入的执行器，不决定 HTTP 响应或业务授权。
import {eq, inArray} from 'drizzle-orm'
import {inquirySettingsSchema, type InquirySettings} from '#shared/schemas/admin/inquiry-settings'
import {customerInquiries, customerInquirySettings} from '../db/schema'
import type {DatabaseExecutor} from '../db/transaction'

export async function readInquirySettings(db: DatabaseExecutor, lock?: 'share' | 'update') {
    const query = db.select().from(customerInquirySettings).where(eq(customerInquirySettings.id, 1))
    const [row] = await (lock ? query.for(lock) : query)
    if (!row) throw new Error('INQUIRY_SETTINGS_MIGRATION_REQUIRED')
    return {...row, settings: inquirySettingsSchema.parse(row.settings)}
}

export const saveInquirySettingsRow = (db: DatabaseExecutor, version: number, settings: InquirySettings) =>
    db.update(customerInquirySettings).set({version, settings}).where(eq(customerInquirySettings.id, 1))

export async function hasInquiryCategoryReferences(db: DatabaseExecutor, codes: string[]) {
    return codes.length > 0 && (await db.select({id: customerInquiries.id}).from(customerInquiries)
        .where(inArray(customerInquiries.category, codes)).limit(1)).length > 0
}
