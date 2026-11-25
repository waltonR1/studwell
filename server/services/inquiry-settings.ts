import {requireSiteModule} from './site-modules'
// 协调咨询分类和邮件设置的读取、授权及保存。
import {requiredLocalized} from '../policies/localized'
import {resolvePublicLocale,readSiteLanguages} from './site-languages'
import {assertInquiryLanguages} from '../policies/site-language-content'
import {lockSiteConfig} from '../repositories/website-site-config'
import {inquiryForwardTemplatesSchema, type InquirySettingsUpdate} from '#shared/schemas/admin/inquiry-settings'
import type {PublicLocale} from '#shared/schemas/public/queries'
import type {AuthMeta} from '../core/auth-context'
import {ApiError, conflictError} from '../core/errors'
import type {Database, DatabaseExecutor} from '../db/transaction'
import {auditChanges} from '../policies/audit-changes'
import {hasInquiryCategoryReferences, readInquirySettings, saveInquirySettingsRow} from '../repositories/inquiry-settings'
import {requirePermission} from './access/permissions'
import {auditedWrite} from './operations/audited-write'
import {inquiryRepository} from '../repositories/inquiries'

export const inquirySettingsPermission = 'content.inquiries.settings'
async function assigneeChoices(db: DatabaseExecutor) {
    return (await inquiryRepository.assignees(db)).map(user => ({id: String(user.id), name: user.name}))
}
export async function publicInquiryCategories(db: DatabaseExecutor, requested?: PublicLocale) {
    await requireSiteModule(db,'inquiries')
    const locale=await resolvePublicLocale(db,requested)
    const {settings} = await readInquirySettings(db)
    return settings.categories.filter(category => category.enabled).map(category => ({code: category.code, label: requiredLocalized(category.labels,locale)}))
}
export async function getInquirySettings(db: DatabaseExecutor, actor: bigint, transportConfigured: boolean) {
    await requirePermission(db, actor, inquirySettingsPermission)
    const {version, settings, forwardTemplateDefaults} = await readInquirySettings(db)
    return {version, settings, transportConfigured, forwardTemplateDefaults: inquiryForwardTemplatesSchema.parse(forwardTemplateDefaults), assignees: await assigneeChoices(db)}
}
export function updateInquirySettings(db: Database, actor: bigint, meta: AuthMeta, input: InquirySettingsUpdate, transportConfigured: boolean) {
    return auditedWrite(db, {actor, meta, id: 1n, targetType: 'inquiry', targetName: '咨询设置', action: 'inquiry.settings.update', isolationLevel: 'read committed'}, async tx => {
        await requirePermission(tx, actor, inquirySettingsPermission)
        await lockSiteConfig(tx)
        const old = await readInquirySettings(tx, 'update')
        if (old.version !== input.version) throw conflictError('STALE', 'version')
        const {settings} = input
        assertInquiryLanguages(settings,(await readSiteLanguages(tx)).enabledLocales)
        const assignees = await assigneeChoices(tx)
        if (settings.categories.some(item => item.enabled && item.defaultAssigneeId && !assignees.some(user => user.id === item.defaultAssigneeId)))
            throw new ApiError('INVALID_INPUT', [{path: 'categories', message: '请选择仍具备咨询处理权限的默认负责人，或改为手动认领。'}])
        if ((settings.mail.forwardEnabled || settings.mail.replyEnabled || settings.mail.assignmentEnabled) && !transportConfigured)
            throw new ApiError('INVALID_INPUT', [{path: 'mail', message: '请先配置服务器发信服务，再启用邮件功能。'}])
        const removed = old.settings.categories.filter(item => !settings.categories.some(next => next.code === item.code))
        if (await hasInquiryCategoryReferences(tx, removed.map(item => item.code)))
            throw new ApiError('INVALID_INPUT', [{path: 'categories', message: '有咨询记录使用了被移除的类型，请改为停用。'}])
        const version = old.version + 1
        await saveInquirySettingsRow(tx, version, settings)
        return {id: 1n, name: '咨询设置', value: {version, settings, transportConfigured, assignees, forwardTemplateDefaults: inquiryForwardTemplatesSchema.parse(old.forwardTemplateDefaults)},
            changes: auditChanges('inquiry', {settingsVersion: old.version}, {settingsVersion: version})}
    })
}
