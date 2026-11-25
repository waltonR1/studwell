// 审计目标允许记录的字段白名单；计算与持久化校验共用。
import type {LogChangeField} from '#shared/types/admin/log-changes'

export const auditChangeFields = {
    careers: ['name','settingsVersion'],
    inquiry: ['settingsVersion'],
    news: ['name','code','enabled','sortOrder','settingsVersion','settingsFields'],
    site_settings: ['settingsVersion', 'settingsSection', 'settingsFields'],
    media: ['name', 'remark', 'originalName', 'storageKey', 'kind', 'mime', 'size'],
    user: ['username', 'displayName', 'email', 'phone', 'department', 'position', 'remark', 'enabled', 'mustChangePassword', 'passwordReset', 'roles'],
    role: ['code', 'name', 'enabled', 'permissions', 'menus'],
    menu: ['code', 'name', 'parentId', 'pageKey', 'iconKey', 'sortOrder', 'visible'],
    dictionary: ['code', 'name', 'description', 'enabled'],
    dictionary_item: ['dictionaryId', 'code', 'name', 'sortOrder', 'enabled'],
    parameter: ['value', 'override'],
    scheduled_task: ['enabled', 'schedule', 'loginDays', 'auditDays', 'securityDays'],
} satisfies Record<string, LogChangeField[]>
export type AuditChangeTarget = keyof typeof auditChangeFields
