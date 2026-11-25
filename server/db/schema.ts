// 声明持久化表、索引及 JSON 列类型；不承担业务授权和发布编排。
import type {ModuleImageRules} from '#shared/schemas/admin/image-rules'
import type {SupportedLocale} from '#shared/config/site-languages'
import type {WebsiteTemplateSample} from '#shared/types/admin/website-preview'
import type {SectionTemplateRevision} from '#shared/types/admin/section-template'
import type {NewsContent,NewsCategoryInput} from '#shared/schemas/admin/news'
import type {InquiryAction, InquiryStatus} from '#shared/schemas/admin/inquiries'
import type {InquiryMailKind, InquiryMailResolution, InquiryMailStatus, InquirySettings} from '#shared/schemas/admin/inquiry-settings'
import type {InquiryCategory, InquirySubmission} from '#shared/schemas/public/inquiries'
// 数据库表结构统一入口；按系统基础模块纵向交付 Schema 与 Migration，不提前创建后续内容业务表。
import type {LogChangeContext} from '#shared/types/admin/log-changes'
import {sql} from 'drizzle-orm'
import type {LogExportContext, LogCleanupContext} from '#shared/types/admin/logs.ts'
import type {TaskSchedule, TaskRetention, TaskCount} from '#shared/types/admin/tasks.ts'
import {
    json,
    bigint,
    boolean,
    check,
    int,
    mysqlTable,
    timestamp,
    text,
    tinyint,
    uniqueIndex,
    varchar,
    index,
    primaryKey,
    foreignKey,
    type AnyMySqlColumn
} from 'drizzle-orm/mysql-core'

// 所有实体插入先通过 withEntityIds 分配；遗漏时立即失败，禁止退回自增或占位主键。
export const adminEntityIdCounters = mysqlTable('admin_entity_id_counters', {
    key: varchar('counter_key', {length: 10}).primaryKey(),
    lastValue: int('sequence_value', {unsigned: true}).notNull(),
})

export const adminUsers = mysqlTable('admin_users', {
    id: bigint('id', {mode: 'bigint', unsigned: true}).$defaultFn((): bigint => { throw new Error('ENTITY_ID_REQUIRED') }).primaryKey(),
    username: varchar('username', {length: 64}).notNull(),
    displayName: varchar('display_name', {length: 80}).notNull(),
    email: varchar('email', {length: 254}),
    phone: varchar('phone', {length: 32}),
    department: varchar('department', {length: 80}),
    position: varchar('position', {length: 80}),
    remark: varchar('remark', {length: 500}),
    passwordHash: varchar('password_hash', {length: 255}).notNull(),
    isRoot: boolean('is_root').notNull().default(false),
    rootSlot: tinyint('root_slot').generatedAlwaysAs(sql`CASE WHEN is_root = 1 THEN 1 ELSE NULL
    END`, {mode: 'stored'}),
    enabled: boolean('enabled').notNull().default(true),
    mustChangePassword: boolean('must_change_password').notNull().default(true),
    version: int('version', {unsigned: true}).notNull().default(1),
    createdAt: timestamp('created_at', {mode: 'date', fsp: 3}).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', {mode: 'date', fsp: 3}).notNull().defaultNow(),
    createdBy: bigint('created_by', {
        mode: 'bigint',
        unsigned: true
    }).references((): AnyMySqlColumn => adminUsers.id, {onDelete: 'restrict'}),
    updatedBy: bigint('updated_by', {
        mode: 'bigint',
        unsigned: true
    }).references((): AnyMySqlColumn => adminUsers.id, {onDelete: 'restrict'}),
    deletedAt: timestamp('deleted_at', {mode: 'date', fsp: 3}),
    activeUsername: varchar('active_username', {length: 64}).generatedAlwaysAs(sql`CASE WHEN deleted_at IS NULL THEN username ELSE NULL
    END`, {mode: 'stored'}),
}, table => [
    uniqueIndex('admin_users_username_unique').on(table.activeUsername),
    uniqueIndex('admin_users_single_root').on(table.rootSlot),
    check('admin_users_username_canonical', sql`REGEXP_LIKE
    (
    ${table.username},
    '^[a-z0-9_]{3,64}$',
    'c'
    )`),
    check('admin_users_root_identity', sql`(${table.isRoot} = 1 AND ${table.username} = 'root' AND ${table.enabled} = 1 AND ${table.deletedAt} IS NULL)
                                           OR (
                                           ${table.isRoot}
                                           =
                                           0
                                           AND
                                           ${table.username}
                                           <>
                                           'root'
                                           )`),
    check('admin_users_version_positive', sql`${table.version}
    > 0`),
])

// 匿名 CSRF 引导与已认证会话共用表；原始 Session Token 不持久化。
export const adminSessions = mysqlTable('admin_sessions', {
    idleTimeoutMs: int('idle_timeout_ms', {unsigned: true}).notNull(),
    id: bigint('id', {mode: 'bigint', unsigned: true}).$defaultFn((): bigint => { throw new Error('ENTITY_ID_REQUIRED') }).primaryKey(),
    tokenHash: varchar('token_hash', {length: 64}).notNull(),
    userId: bigint('user_id', {mode: 'bigint', unsigned: true}).references(() => adminUsers.id, {onDelete: 'restrict'}),
    createdAt: timestamp('created_at', {mode: 'date', fsp: 3}).notNull(),
    lastActivityAt: timestamp('last_activity_at', {mode: 'date', fsp: 3}).notNull(),
    expiresAt: timestamp('expires_at', {mode: 'date', fsp: 3}).notNull(),
}, table => [uniqueIndex('admin_sessions_token_unique').on(table.tokenHash), index('admin_sessions_user').on(table.userId), index('admin_sessions_expiry').on(table.expiresAt)])

export const adminRateLimits = mysqlTable('admin_rate_limits', {
    key: varchar('key', {length: 80}).primaryKey(),
    hits: int('hits', {unsigned: true}).notNull(),
    windowStart: timestamp('window_start', {mode: 'date', fsp: 3}).notNull(),
}, table => [index('admin_rate_limits_window').on(table.windowStart)])

export const adminAuthLogs = mysqlTable('admin_auth_logs', {
    requestMethod: varchar('request_method', {length: 8}),
    routeTemplate: varchar('route_template', {length: 160}),
    permissionCode: varchar('permission_code', {length: 80}),
    rateLimitScope: varchar('rate_limit_scope', {length: 40}),
    id: bigint('id', {mode: 'bigint', unsigned: true}).$defaultFn((): bigint => { throw new Error('ENTITY_ID_REQUIRED') }).primaryKey(),
    userId: bigint('user_id', {mode: 'bigint', unsigned: true}),
    username: varchar('username', {length: 64}),
    action: varchar('action', {length: 40}).notNull(),
    reasonCode: varchar('reason_code', {length: 40}),
    result: varchar('result', {length: 16}).notNull(),
    ip: varchar('ip', {length: 45}).notNull(),
    userAgent: varchar('user_agent', {length: 256}).notNull(),
    requestId: varchar('request_id', {length: 36}).notNull(),
    createdAt: timestamp('created_at', {mode: 'date', fsp: 3}).notNull(),
}, table => [index('admin_auth_logs_time').on(table.createdAt), index('admin_auth_logs_request').on(table.requestId), index('admin_auth_logs_user_time').on(table.userId, table.createdAt)])

export const adminRoles = mysqlTable('admin_roles', {
    id: bigint('id', {mode: 'bigint', unsigned: true}).$defaultFn((): bigint => { throw new Error('ENTITY_ID_REQUIRED') }).primaryKey(),
    code: varchar('code', {length: 64}).notNull(),
    name: varchar('name', {length: 80}).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    version: int('version', {unsigned: true}).notNull().default(1),
    createdAt: timestamp('created_at', {mode: 'date', fsp: 3}).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', {mode: 'date', fsp: 3}).notNull().defaultNow(),
    createdBy: bigint('created_by', {
        mode: 'bigint',
        unsigned: true
    }).references(() => adminUsers.id, {onDelete: 'restrict'}),
    updatedBy: bigint('updated_by', {
        mode: 'bigint',
        unsigned: true
    }).references(() => adminUsers.id, {onDelete: 'restrict'}),
}, table => [uniqueIndex('admin_roles_code_unique').on(table.code), check('admin_roles_code_canonical', sql`REGEXP_LIKE
(
${table.code},
'^[a-z][a-z0-9_]{2,63}$',
'c'
)`), check('admin_roles_version_positive', sql`${table.version}
> 0`)])

export const adminPermissions = mysqlTable('admin_permissions', {
    id: bigint('id', {mode: 'bigint', unsigned: true}).$defaultFn((): bigint => { throw new Error('ENTITY_ID_REQUIRED') }).primaryKey(),
    code: varchar('code', {length: 80}).notNull(),
    name: varchar('name', {length: 80}).notNull(),
    available: boolean('available').notNull().default(false),
}, table => [uniqueIndex('admin_permissions_code_unique').on(table.code), check('admin_permissions_code_canonical', sql`REGEXP_LIKE
(
${table.code},
'^[a-z][a-z0-9_.]{2,79}$',
'c'
)`)])

export const adminUserRoles = mysqlTable('admin_user_roles', {
    userId: bigint('user_id', {
        mode: 'bigint',
        unsigned: true
    }).notNull().references(() => adminUsers.id, {onDelete: 'restrict'}),
    roleId: bigint('role_id', {
        mode: 'bigint',
        unsigned: true
    }).notNull().references(() => adminRoles.id, {onDelete: 'restrict'}),
}, table => [primaryKey({columns: [table.userId, table.roleId]}), index('admin_user_roles_role').on(table.roleId)])

export const adminRolePermissions = mysqlTable('admin_role_permissions', {
    roleId: bigint('role_id', {
        mode: 'bigint',
        unsigned: true
    }).notNull().references(() => adminRoles.id, {onDelete: 'restrict'}),
    permissionId: bigint('permission_id', {
        mode: 'bigint',
        unsigned: true
    }).notNull().references(() => adminPermissions.id, {onDelete: 'restrict'}),
}, table => [primaryKey({columns: [table.roleId, table.permissionId]}), index('admin_role_permissions_permission').on(table.permissionId)])

// 重要操作审计：保存受控目标名称和字段差异，不保存完整对象或凭据。
export const adminOperationLogs = mysqlTable('admin_operation_logs', {
    changeContext: json('change_context').$type<LogChangeContext>(),
    reasonCode: varchar('reason_code', {length: 40}),
    exportContext: json('export_context').$type<LogExportContext>(),
    cleanupContext: json('cleanup_context').$type<LogCleanupContext>(),
    id: bigint('id', {mode: 'bigint', unsigned: true}).$defaultFn((): bigint => { throw new Error('ENTITY_ID_REQUIRED') }).primaryKey(),
    actorId: bigint('actor_id', {mode: 'bigint', unsigned: true}),
    action: varchar('action', {length: 40}).notNull(),
    targetType: varchar('target_type', {length: 40}).notNull(),
    targetId: varchar('target_id', {length: 40}),
    targetName: varchar('target_name', {length: 80}),
    result: varchar('result', {length: 16}).notNull(),
    ip: varchar('ip', {length: 45}).notNull(),
    userAgent: varchar('user_agent', {length: 256}).notNull(),
    requestId: varchar('request_id', {length: 36}).notNull(),
    createdAt: timestamp('created_at', {mode: 'date', fsp: 3}).notNull(),
}, table => [index('admin_operation_logs_time').on(table.createdAt), index('admin_operation_logs_request').on(table.requestId), index('admin_operation_logs_actor_time').on(table.actorId, table.createdAt)])

// 菜单只控制导航组织/可见性，业务功能可用性仍由代码目录和 API 策略裁决。
export const adminMenus = mysqlTable('admin_menus', {
    id: bigint('id', {mode: 'bigint', unsigned: true}).$defaultFn((): bigint => { throw new Error('ENTITY_ID_REQUIRED') }).primaryKey(),
    parentId: bigint('parent_id', {
        mode: 'bigint',
        unsigned: true
    }).references((): AnyMySqlColumn => adminMenus.id, {onDelete: 'restrict'}),
    code: varchar('code', {length: 64}).notNull(),
    pageKey: varchar('page_key', {length: 64}),
    // 仅 website_page 可重复绑定；固定页面继续由数据库唯一索引兜底。
    uniqueBindingKey: varchar('unique_binding_key', {length: 64}).generatedAlwaysAs(sql`CASE WHEN page_key = 'website_page' THEN NULL ELSE page_key
    END`, {mode: 'stored'}),
    name: varchar('name', {length: 80}).notNull(),
    iconKey: varchar('icon_key', {length: 40}).notNull(),
    sortOrder: int('sort_order', {unsigned: true}).notNull().default(0),
    visible: boolean('visible').notNull().default(true),
    version: int('version', {unsigned: true}).notNull().default(1),
    createdAt: timestamp('created_at', {mode: 'date', fsp: 3}).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', {mode: 'date', fsp: 3}).notNull().defaultNow(),
    createdBy: bigint('created_by', {
        mode: 'bigint',
        unsigned: true
    }).references(() => adminUsers.id, {onDelete: 'restrict'}),
    updatedBy: bigint('updated_by', {
        mode: 'bigint',
        unsigned: true
    }).references(() => adminUsers.id, {onDelete: 'restrict'}),
}, table => [uniqueIndex('admin_menus_code_unique').on(table.code), uniqueIndex('admin_menus_page_unique').on(table.uniqueBindingKey), index('admin_menus_parent_order').on(table.parentId, table.sortOrder), check('admin_menus_code_canonical', sql`REGEXP_LIKE
(
${table.code},
'^[a-z][a-z0-9_]{2,63}$',
'c'
)`), check('admin_menus_version_positive', sql`${table.version}
> 0`)])

export const adminRoleMenus = mysqlTable('admin_role_menus', {
    roleId: bigint('role_id', {
        mode: 'bigint',
        unsigned: true
    }).notNull().references(() => adminRoles.id, {onDelete: 'restrict'}),
    menuId: bigint('menu_id', {
        mode: 'bigint',
        unsigned: true
    }).notNull().references(() => adminMenus.id, {onDelete: 'restrict'}),
}, table => [primaryKey({columns: [table.roleId, table.menuId]}), index('admin_role_menus_menu').on(table.menuId)])

// 系统参数保存数据库默认值及覆盖值；null 表示没有覆盖。
export const adminParameters = mysqlTable('admin_parameters', {
    id: bigint('id', {mode: 'bigint', unsigned: true}).$defaultFn((): bigint => { throw new Error('ENTITY_ID_REQUIRED') }).primaryKey(),
    key: varchar('parameter_key', {length: 80}).notNull(),
    defaultValue: varchar('parameter_default_value', {length: 1024}).notNull(),
    value: varchar('parameter_value', {length: 1024}),
    version: int('version', {unsigned: true}).notNull().default(1),
    createdAt: timestamp('created_at', {mode: 'date', fsp: 3}).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', {mode: 'date', fsp: 3}).notNull().defaultNow(),
    createdBy: bigint('created_by', {
        mode: 'bigint',
        unsigned: true
    }).references(() => adminUsers.id, {onDelete: 'restrict'}),
    updatedBy: bigint('updated_by', {
        mode: 'bigint',
        unsigned: true
    }).references(() => adminUsers.id, {onDelete: 'restrict'}),
}, table => [uniqueIndex('admin_parameters_key_unique').on(table.key), check('admin_parameters_version_positive', sql`${table.version}
> 0`)])

// 可配置业务下拉项；核心状态仍由代码维护，不开放物理删除。
export const adminDictionaries = mysqlTable('admin_dictionaries', {
    id: bigint('id', {mode: 'bigint', unsigned: true}).$defaultFn((): bigint => { throw new Error('ENTITY_ID_REQUIRED') }).primaryKey(),
    code: varchar('code', {length: 64}).notNull(),
    name: varchar('name', {length: 80}).notNull(),
    description: varchar('description', {length: 300}).notNull().default(''),
    enabled: boolean('enabled').notNull().default(true),
    version: int('version', {unsigned: true}).notNull().default(1),
    createdAt: timestamp('created_at', {mode: 'date', fsp: 3}).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', {mode: 'date', fsp: 3}).notNull().defaultNow(),
    createdBy: bigint('created_by', {
        mode: 'bigint',
        unsigned: true
    }).references(() => adminUsers.id, {onDelete: 'restrict'}),
    updatedBy: bigint('updated_by', {
        mode: 'bigint',
        unsigned: true
    }).references(() => adminUsers.id, {onDelete: 'restrict'}),
}, table => [uniqueIndex('admin_dictionaries_code_unique').on(table.code), check('admin_dictionaries_code_canonical', sql`REGEXP_LIKE
(
${table.code},
'^[a-z][a-z0-9_]{2,63}$',
'c'
)`), check('admin_dictionaries_version_positive', sql`${table.version}
> 0`)])

export const adminDictionaryItems = mysqlTable('admin_dictionary_items', {
    id: bigint('id', {mode: 'bigint', unsigned: true}).$defaultFn((): bigint => { throw new Error('ENTITY_ID_REQUIRED') }).primaryKey(),
    dictionaryId: bigint('dictionary_id', {
        mode: 'bigint',
        unsigned: true
    }).notNull().references(() => adminDictionaries.id, {onDelete: 'restrict'}),
    code: varchar('code', {length: 64}).notNull(),
    name: varchar('name', {length: 80}).notNull(),
    sortOrder: int('sort_order', {unsigned: true}).notNull().default(0),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', {mode: 'date', fsp: 3}).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', {mode: 'date', fsp: 3}).notNull().defaultNow(),
    createdBy: bigint('created_by', {
        mode: 'bigint',
        unsigned: true
    }).references(() => adminUsers.id, {onDelete: 'restrict'}),
    updatedBy: bigint('updated_by', {
        mode: 'bigint',
        unsigned: true
    }).references(() => adminUsers.id, {onDelete: 'restrict'}),
}, table => [uniqueIndex('admin_dictionary_items_code_unique').on(table.dictionaryId, table.code), index('admin_dictionary_items_order').on(table.dictionaryId, table.sortOrder, table.id), check('admin_dictionary_items_code_canonical', sql`REGEXP_LIKE
(
${table.code},
'^[a-z][a-z0-9_]{2,63}$',
'c'
)`)])

// 固定任务状态；执行身份仅服务端使用，不能暴露给任务页面。
export const adminTasks = mysqlTable('admin_tasks', {
    id: bigint('id', {mode: 'bigint', unsigned: true}).$defaultFn((): bigint => { throw new Error('ENTITY_ID_REQUIRED') }).primaryKey(),
    code: varchar('code', {length: 40}).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    schedule: json('schedule').$type<TaskSchedule>().notNull(),
    retention: json('retention').$type<TaskRetention>(),
    version: int('version', {unsigned: true}).notNull().default(1),
    appliedVersion: int('applied_version', {unsigned: true}).notNull().default(0),
    heartbeatAt: timestamp('heartbeat_at', {mode: 'date', fsp: 3}),
    nextRunAt: timestamp('next_run_at', {mode: 'date', fsp: 3}),
    pendingTrigger: varchar('pending_trigger', {length: 20}).notNull().default('startup'),
    pendingGroupId: varchar('pending_group_id', {length: 36}),
    pendingRetry: int('pending_retry', {unsigned: true}).notNull().default(0),
    pendingContinuation: int('pending_continuation', {unsigned: true}).notNull().default(0),
    activeRunId: bigint('active_run_id', {mode: 'bigint', unsigned: true}),
    activeToken: varchar('active_token', {length: 36}),
    ownerId: varchar('owner_id', {length: 36}),
    leaseUntil: timestamp('lease_until', {mode: 'date', fsp: 3}),
    updatedAt: timestamp('updated_at', {mode: 'date', fsp: 3}).notNull().defaultNow(),
}, table => [uniqueIndex('admin_tasks_code').on(table.code)])

export const adminTaskRuns = mysqlTable('admin_task_runs', {
    id: bigint('id', {mode: 'bigint', unsigned: true}).$defaultFn((): bigint => { throw new Error('ENTITY_ID_REQUIRED') }).primaryKey(),
    taskId: bigint('task_id', {
        mode: 'bigint',
        unsigned: true
    }).notNull().references(() => adminTasks.id, {onDelete: 'restrict'}),
    token: varchar('token', {length: 36}).notNull(),
    groupId: varchar('group_id', {length: 36}).notNull(),
    requestId: varchar('request_id', {length: 36}).notNull(),
    trigger: varchar('trigger_type', {length: 20}).notNull(),
    status: varchar('status', {length: 20}).notNull().default('queued'),
    snapshot: json('snapshot').$type<{ schedule: TaskSchedule; retention: TaskRetention | null }>().notNull(),
    counts: json('counts').$type<TaskCount[]>().notNull(),
    attempt: int('attempt', {unsigned: true}).notNull().default(0),
    continuation: int('continuation', {unsigned: true}).notNull().default(0),
    createdBy: bigint('created_by', {mode: 'bigint', unsigned: true}),
    createdAt: timestamp('created_at', {mode: 'date', fsp: 3}).notNull(),
    startedAt: timestamp('started_at', {mode: 'date', fsp: 3}),
    finishedAt: timestamp('finished_at', {mode: 'date', fsp: 3}),
    reason: varchar('reason', {length: 40}),
    retryAt: timestamp('retry_at', {mode: 'date', fsp: 3}),
}, table => [index('admin_task_runs_task_time').on(table.taskId, table.createdAt), index('admin_task_runs_finished').on(table.status, table.finishedAt), uniqueIndex('admin_task_runs_request').on(table.requestId)])

// 独立控制信箱：长事务持有进度行锁时，仍能持久化停止/强制终止请求。
export const adminTaskCommands = mysqlTable('admin_task_commands', {
    id: bigint('id', {mode: 'bigint', unsigned: true}).$defaultFn((): bigint => { throw new Error('ENTITY_ID_REQUIRED') }).primaryKey(),
    runId: bigint('run_id', {mode: 'bigint', unsigned: true}).notNull(),
    token: varchar('token', {length: 36}).notNull(),
    action: varchar('action', {length: 10}).notNull(),
    createdAt: timestamp('created_at', {mode: 'date', fsp: 3}).notNull(),
    handledAt: timestamp('handled_at', {mode: 'date', fsp: 3}),
}, table => [index('admin_task_commands_pending').on(table.runId, table.handledAt)])

// 公开媒体：原文件不可覆盖，元数据与业务引用分别持久化。
export const mediaAssets = mysqlTable('media_assets', {
    id: bigint('id', {mode: 'bigint', unsigned: true}).$defaultFn((): bigint => {throw new Error('ENTITY_ID_REQUIRED')}).primaryKey(),
    storageKey: varchar('storage_key', {length: 80}).notNull(),
    name: varchar('name', {length: 160}).notNull(), originalName: varchar('original_name', {length: 255}).notNull(),
    kind: varchar('kind', {length: 16}).$type<'image' | 'video'>().notNull(), mime: varchar('mime', {length: 80}).notNull(),
    size: int('size', {unsigned: true}).notNull(), width: int('width', {unsigned: true}), height: int('height', {unsigned: true}),
    remark: varchar('remark', {length: 1000}).notNull().default(''),
    version: int('version', {unsigned: true}).notNull().default(1),
    createdBy: bigint('created_by', {mode: 'bigint', unsigned: true}).notNull().references(() => adminUsers.id, {onDelete: 'restrict'}),
    updatedBy: bigint('updated_by', {mode: 'bigint', unsigned: true}).notNull().references(() => adminUsers.id, {onDelete: 'restrict'}),
    createdAt: timestamp('created_at', {mode: 'date', fsp: 3}).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', {mode: 'date', fsp: 3}).notNull().defaultNow(),
}, table => [uniqueIndex('media_storage_key_unique').on(table.storageKey), index('media_created').on(table.createdAt), check('media_version_positive', sql`${table.version} > 0`)])

export const mediaReferences = mysqlTable('media_references', {
    id: bigint('id', {mode:'bigint',unsigned:true}).$defaultFn((): bigint => {throw new Error('ENTITY_ID_REQUIRED')}).primaryKey(),
    mediaId: bigint('media_id', {mode:'bigint',unsigned:true}).notNull().references(() => mediaAssets.id, {onDelete:'restrict'}),
    owner: varchar('owner', {length:160}).notNull(),
    field: varchar('field', {length:80}).notNull(),
}, table => [uniqueIndex('media_reference_slot_unique').on(table.owner,table.field),index('media_reference_asset').on(table.mediaId)])

// 公共模块及页面共用独立资源与发布机制；业务内容按资源类型严格校验。
const websiteId = () => bigint('id', {mode:'bigint',unsigned:true}).$defaultFn(():bigint=>{throw new Error('ENTITY_ID_REQUIRED')}).primaryKey()
const websiteActor = (name:string) => bigint(name,{mode:'bigint',unsigned:true}).notNull().references(()=>adminUsers.id,{onDelete:'restrict'})
export const websiteResources = mysqlTable('website_resources', {
 id:websiteId(), key:varchar('resource_key',{length:80}).notNull(), type:varchar('resource_type',{length:8}).$type<'basic'|'header'|'footer'|'page'>().notNull(),
 stateVersion:int('state_version',{unsigned:true}).notNull().default(1),
 draftVersion:int('draft_version',{unsigned:true}).notNull().default(1), publishedReleaseId:bigint('published_release_id',{mode:'bigint',unsigned:true}),
 createdBy:websiteActor('created_by'),updatedBy:websiteActor('updated_by'),createdAt:timestamp('created_at',{mode:'date',fsp:3}).notNull().defaultNow(),updatedAt:timestamp('updated_at',{mode:'date',fsp:3}).notNull().defaultNow(),
},t=>[uniqueIndex('website_resource_key').on(t.key),check('website_resource_type',sql`${t.type} IN ('basic','header','footer','page')`),foreignKey({name:'website_resource_publication',columns:[t.id,t.publishedReleaseId],foreignColumns:[websiteReleases.resourceId,websiteReleases.id]}).onDelete('restrict')])
export const websiteDrafts = mysqlTable('website_drafts',{
 resourceId:bigint('resource_id',{mode:'bigint',unsigned:true}).primaryKey().references(()=>websiteResources.id,{onDelete:'restrict'}),settingsVersion:int('settings_version',{unsigned:true}).notNull().default(1),schemaVersion:int('schema_version',{unsigned:true}).notNull().default(1),content:json('content').$type<unknown>().notNull(),updatedBy:websiteActor('updated_by'),updatedAt:timestamp('updated_at',{mode:'date',fsp:3}).notNull().defaultNow(),
})
export const websiteTemplates = mysqlTable('website_templates',{
 previewSample:json('preview_sample').$type<WebsiteTemplateSample>(),
 id:websiteId(),coverMediaId:bigint('cover_media_id',{mode:'bigint',unsigned:true}).references(()=>mediaAssets.id,{onDelete:'restrict'}),key:varchar('template_key',{length:100}).notNull(),name:varchar('display_name',{length:100}).notNull(),description:varchar('description',{length:1000}).notNull().default(''),enabledForNew:boolean('enabled_for_new').notNull().default(true),metadataVersion:int('metadata_version',{unsigned:true}).notNull().default(1),createdBy:websiteActor('created_by'),updatedBy:websiteActor('updated_by'),createdAt:timestamp('created_at',{mode:'date',fsp:3}).notNull().defaultNow(),updatedAt:timestamp('updated_at',{mode:'date',fsp:3}).notNull().defaultNow(),
},t=>[uniqueIndex('website_template_key').on(t.key)])
export const websiteRenderers = mysqlTable('website_renderers', {
 scope: varchar('scope', {length:8}).$type<'public'|'preview'>().notNull(),
 key: varchar('renderer_key', {length:100}).notNull(),
 componentPath: varchar('component_path', {length:512}).notNull(),
}, t => [primaryKey({columns:[t.scope,t.key]})])
export const websiteTemplateRevisions = mysqlTable('website_template_revisions', {
 templateId: bigint('template_id', {mode:'bigint', unsigned:true}).notNull().references(() => websiteTemplates.id, {onDelete:'cascade'}),
 version: int('version', {unsigned:true}).notNull(),
 definition: json('definition').$type<SectionTemplateRevision>().notNull(),
 createdAt: timestamp('created_at', {mode:'date', fsp:3}).notNull().defaultNow(),
}, t => [uniqueIndex('website_template_revision_version').on(t.templateId, t.version)])
export const websiteSections = mysqlTable('website_sections',{
 templateRevision: int('template_revision', {unsigned:true}).notNull(),
 id:websiteId(),resourceId:bigint('resource_id',{mode:'bigint',unsigned:true}).notNull().references(()=>websiteResources.id,{onDelete:'restrict'}),templateId:bigint('template_id',{mode:'bigint',unsigned:true}).notNull().references(()=>websiteTemplates.id,{onDelete:'restrict'}),instanceName:varchar('instance_name',{length:100}),sortOrder:int('sort_order',{unsigned:true}).notNull(),visible:boolean('visible').notNull().default(true),anchorKey:varchar('anchor_key',{length:64}).notNull(),sharedContent:json('shared_content').$type<Record<string,unknown>>().notNull(),localizedContent:json('localized_content').$type<Record<string,unknown>>().notNull(),contentVersion:int('content_version',{unsigned:true}).notNull().default(1),structureVersion:int('structure_version',{unsigned:true}).notNull().default(1),createdBy:websiteActor('created_by'),updatedBy:websiteActor('updated_by'),createdAt:timestamp('created_at',{mode:'date',fsp:3}).notNull().defaultNow(),updatedAt:timestamp('updated_at',{mode:'date',fsp:3}).notNull().defaultNow(),
},t=>[foreignKey({name:'website_section_template_revision',columns:[t.templateId,t.templateRevision],foreignColumns:[websiteTemplateRevisions.templateId,websiteTemplateRevisions.version]}).onDelete('restrict'),uniqueIndex('website_section_anchor').on(t.resourceId,t.anchorKey),index('website_section_order').on(t.resourceId,t.sortOrder)])
export const websiteNavigation = mysqlTable('website_navigation',{
 id:websiteId(),resourceId:bigint('resource_id',{mode:'bigint',unsigned:true}).notNull().references(()=>websiteResources.id,{onDelete:'restrict'}),kind:varchar('kind',{length:8}).notNull(),parentId:bigint('parent_id',{mode:'bigint',unsigned:true}),code:varchar('code',{length:64}).notNull(),labels:json('labels').$type<Record<string,string>>().notNull(),targetResourceId:bigint('target_resource_id',{mode:'bigint',unsigned:true}),module:varchar('module',{length:64}).notNull().default(''),targetType:varchar('target_type',{length:24}).notNull().default('page'),targetValue:varchar('target_value',{length:2000}).notNull().default(''),visible:boolean('visible').notNull(),sortOrder:int('sort_order',{unsigned:true}).notNull(),
},t=>[uniqueIndex('website_navigation_resource_id').on(t.resourceId,t.id),foreignKey({name:'website_navigation_parent',columns:[t.resourceId,t.parentId],foreignColumns:[t.resourceId,t.id]}).onDelete('restrict'),check('website_navigation_kind',sql`${t.kind} IN ('group','link')`),index('website_navigation_order').on(t.resourceId,t.parentId,t.sortOrder)])
export const websiteReleases = mysqlTable('website_releases',{
 id:websiteId(),resourceId:bigint('resource_id',{mode:'bigint',unsigned:true}).notNull().references(():AnyMySqlColumn=>websiteResources.id,{onDelete:'restrict'}),snapshotSchemaVersion:int('snapshot_schema_version',{unsigned:true}).notNull().default(1),draftVersion:int('draft_version',{unsigned:true}).notNull(),content:json('content').$type<unknown>().notNull(),contentHash:varchar('content_hash',{length:64}).notNull(),restoredFrom:bigint('restored_from',{mode:'bigint',unsigned:true}),createdBy:websiteActor('created_by'),createdAt:timestamp('created_at',{mode:'date',fsp:3}).notNull().defaultNow(),
},t=>[uniqueIndex('website_release_resource_id').on(t.resourceId,t.id),index('website_release_history').on(t.resourceId,t.createdAt,t.id),foreignKey({name:'website_release_source',columns:[t.resourceId,t.restoredFrom],foreignColumns:[t.resourceId,t.id]}).onDelete('restrict')])

// 新闻运营配置独立于新闻页面的草稿与发布版本。
export const newsOperations=mysqlTable('news_operations',{
 id:int('id',{unsigned:true}).primaryKey(),
 viewCountEnabled:boolean('view_count_enabled').notNull().default(false),
 version:int('version',{unsigned:true}).notNull().default(1),
})

export const newsCategories=mysqlTable('news_categories',{
 id:websiteId(),code:varchar('code',{length:64}).notNull(),name:json('name').$type<NewsCategoryInput['name']>().notNull(),sortOrder:int('sort_order',{unsigned:true}).notNull(),enabled:boolean('enabled').notNull().default(true),version:int('version',{unsigned:true}).notNull().default(1),
 createdBy:websiteActor('created_by'),updatedBy:websiteActor('updated_by'),createdAt:timestamp('created_at',{mode:'date',fsp:3}).notNull().defaultNow(),updatedAt:timestamp('updated_at',{mode:'date',fsp:3}).notNull().defaultNow(),
},t=>[uniqueIndex('news_category_code').on(t.code)])
export const newsArticles=mysqlTable('news_articles',{
 viewCount:int('view_count',{unsigned:true}).notNull().default(0),
 id:websiteId(),slug:varchar('slug',{length:64}).notNull(),categoryId:bigint('category_id',{mode:'bigint',unsigned:true}).notNull().references(()=>newsCategories.id,{onDelete:'restrict'}),content:json('content').$type<NewsContent>().notNull(),
 draftVersion:int('draft_version',{unsigned:true}).notNull().default(1),stateVersion:int('state_version',{unsigned:true}).notNull().default(1),publishedReleaseId:bigint('published_release_id',{mode:'bigint',unsigned:true}),
 createdBy:websiteActor('created_by'),updatedBy:websiteActor('updated_by'),createdAt:timestamp('created_at',{mode:'date',fsp:3}).notNull().defaultNow(),updatedAt:timestamp('updated_at',{mode:'date',fsp:3}).notNull().defaultNow(),
},t=>[uniqueIndex('news_article_slug').on(t.slug),index('news_article_category').on(t.categoryId),foreignKey({name:'news_article_publication',columns:[t.id,t.publishedReleaseId],foreignColumns:[newsReleases.articleId,newsReleases.id]}).onDelete('restrict')])
export const newsReleases=mysqlTable('news_releases',{
 id:websiteId(),articleId:bigint('article_id',{mode:'bigint',unsigned:true}).notNull().references(():AnyMySqlColumn=>newsArticles.id,{onDelete:'restrict'}),categoryId:bigint('category_id',{mode:'bigint',unsigned:true}).notNull().references(()=>newsCategories.id,{onDelete:'restrict'}),
 content:json('content').$type<NewsContent>().notNull(),contentHash:varchar('content_hash',{length:64}).notNull(),draftVersion:int('draft_version',{unsigned:true}).notNull(),displayDate:varchar('display_date',{length:10}).notNull(),featured:boolean('featured').notNull(),featuredOrder:int('featured_order',{unsigned:true}).notNull(),restoredFrom:bigint('restored_from',{mode:'bigint',unsigned:true}),createdBy:websiteActor('created_by'),createdAt:timestamp('created_at',{mode:'date',fsp:3}).notNull().defaultNow(),
},t=>[uniqueIndex('news_release_article_id').on(t.articleId,t.id),index('news_release_history').on(t.articleId,t.createdAt,t.id),index('news_release_listing').on(t.categoryId,t.displayDate),foreignKey({name:'news_release_source',columns:[t.articleId,t.restoredFrom],foreignColumns:[t.articleId,t.id]}).onDelete('restrict')])

export const careerPositions=mysqlTable('career_positions',{
 id:websiteId(),draft:json('draft').$type<import('#shared/schemas/admin/careers').CareerContent>().notNull(),
 version:int('version',{unsigned:true}).notNull().default(1),publishedReleaseId:bigint('published_release_id',{mode:'bigint',unsigned:true}),
 createdBy:websiteActor('created_by'),updatedBy:websiteActor('updated_by'),
},t=>[foreignKey({name:'career_position_publication',columns:[t.id,t.publishedReleaseId],foreignColumns:[careerPositionReleases.positionId,careerPositionReleases.id]}).onDelete('restrict')])
export const careerPositionReleases=mysqlTable('career_position_releases',{
 id:websiteId(),positionId:bigint('position_id',{mode:'bigint',unsigned:true}).notNull().references(():AnyMySqlColumn=>careerPositions.id,{onDelete:'restrict'}),
 content:json('content').$type<import('#shared/schemas/admin/careers').CareerContent>().notNull(),sortOrder:int('sort_order',{unsigned:true}).notNull(),
 createdBy:websiteActor('created_by'),createdAt:timestamp('created_at',{mode:'date',fsp:3}).notNull().defaultNow(),
},t=>[uniqueIndex('career_release_position_id').on(t.positionId,t.id)])

export const customerInquiries = mysqlTable('customer_inquiries', {
    id: websiteId(),
    submissionKey: varchar('submission_key', {length: 36}).notNull(),
    category: varchar('category', {length: 16}).$type<InquiryCategory>().notNull(),
    locale: varchar('locale', {length: 8}).$type<InquirySubmission['locale']>().notNull(),
    name: varchar('name', {length: 100}).notNull(),
    email: varchar('email', {length: 254}).notNull(),
    company: varchar('company', {length: 120}).notNull(),
    country: varchar('country', {length: 100}).notNull(),
    message: text('message').notNull(),
    status: varchar('status', {length: 16}).$type<InquiryStatus>().notNull().default('pending'),
    assigneeId: bigint('assignee_id', {mode: 'bigint', unsigned: true}).references(() => adminUsers.id, {onDelete: 'restrict'}),
    version: int('version', {unsigned: true}).notNull().default(1),
    createdAt: timestamp('created_at', {mode: 'date', fsp: 3}).notNull().defaultNow(),
}, table => [
    uniqueIndex('customer_inquiry_submission').on(table.submissionKey),
    index('customer_inquiry_status').on(table.status, table.id),
    index('customer_inquiry_category').on(table.category, table.id),
])

export const customerInquiryEvents = mysqlTable('customer_inquiry_events', {
    id: websiteId(),
    inquiryId: bigint('inquiry_id', {mode: 'bigint', unsigned: true}).notNull().references(() => customerInquiries.id, {onDelete: 'restrict'}),
    actorName: varchar('actor_name', {length: 80}).notNull(),
    actorId: websiteActor('actor_id'),
    action: varchar('action', {length: 16}).$type<InquiryAction>().notNull(),
    note: varchar('note', {length: 1000}).notNull().default(''),
    status: varchar('status', {length: 16}).$type<InquiryStatus>(),
    assigneeName: varchar('assignee_name', {length: 80}),
    createdAt: timestamp('created_at', {mode: 'date', fsp: 3}).notNull().defaultNow(),
}, table => [index('customer_inquiry_history').on(table.inquiryId, table.id)])

export const customerInquirySettings = mysqlTable('customer_inquiry_settings', {
    id: int('id', {unsigned: true}).primaryKey(),
    version: int('version', {unsigned: true}).notNull().default(1),
    settings: json('settings').$type<InquirySettings>().notNull(),
    forwardTemplateDefaults: json('forward_template_defaults').$type<InquirySettings['mail']['forwardTemplates']>().notNull(),
})

export const customerInquiryMail = mysqlTable('customer_inquiry_mail', {
    id: websiteId(),
    inquiryId: bigint('inquiry_id', {mode: 'bigint', unsigned: true}).notNull().references(() => customerInquiries.id, {onDelete: 'restrict'}),
    kind: varchar('kind', {length: 10}).$type<InquiryMailKind>().notNull(),
    replyCycleId: bigint('reply_cycle_id', {mode: 'bigint', unsigned: true}),
    status: varchar('status', {length: 12}).$type<InquiryMailStatus>().notNull().default('queued'),
    sender: varchar('sender', {length: 254}).notNull(),
    recipient: varchar('recipient', {length: 254}).notNull(),
    replyTo: varchar('reply_to', {length: 254}).notNull(),
    subject: varchar('subject', {length: 150}).notNull(),
    body: text('body').notNull(),
    attempts: int('attempts', {unsigned: true}).notNull().default(0),
    availableAt: timestamp('available_at', {mode: 'date', fsp: 3}).notNull().defaultNow(),
    sentAt: timestamp('sent_at', {mode: 'date', fsp: 3}),
    resolution: json('resolution').$type<InquiryMailResolution>(),
    createdAt: timestamp('created_at', {mode: 'date', fsp: 3}).notNull().defaultNow(),
}, table => [
    index('customer_inquiry_mail_queue').on(table.status, table.kind, table.availableAt, table.id),
    index('customer_inquiry_mail_history').on(table.inquiryId, table.id),
    foreignKey({name: 'inquiry_mail_reply_cycle_fk', columns: [table.replyCycleId], foreignColumns: [customerInquiryEvents.id]}).onDelete('restrict'),
])

export const websiteRouteNodes = mysqlTable('website_route_nodes', {
 id: bigint('id',{mode:'bigint',unsigned:true}).autoincrement().primaryKey(),
 parentId: bigint('parent_id',{mode:'bigint',unsigned:true}).references(():AnyMySqlColumn=>websiteRouteNodes.id,{onDelete:'restrict'}),
 slug: varchar('slug',{length:64}).notNull(),
 targetType: varchar('target_type',{length:12}).$type<'group'|'page'>().notNull(),
 enabled: boolean('enabled').notNull().default(true),
 resourceId: bigint('resource_id',{mode:'bigint',unsigned:true}).references(()=>websiteResources.id,{onDelete:'restrict'}),
 sortOrder: int('sort_order',{unsigned:true}).notNull().default(0),
},t=>[index('website_route_parent').on(t.parentId),uniqueIndex('website_route_node_target').on(t.resourceId)])

export const websitePublishedRoutes = mysqlTable('website_published_routes', {
 path: varchar('path',{length:390}).primaryKey(),
 routeNodeId: bigint('route_node_id',{mode:'bigint',unsigned:true}).references(()=>websiteRouteNodes.id,{onDelete:'restrict'}),
 resourceId: bigint('resource_id',{mode:'bigint',unsigned:true}).notNull().references(()=>websiteResources.id,{onDelete:'restrict'}),
},t=>[uniqueIndex('website_published_route_target').on(t.resourceId)])

const seoColumns = () => ({
 resourceId:bigint('resource_id',{mode:'bigint',unsigned:true}).notNull().references(()=>websiteResources.id,{onDelete:'restrict'}),
 locale:varchar('locale',{length:5}).$type<SupportedLocale>().notNull(),
 title:varchar('title',{length:200}).notNull(),description:varchar('description',{length:500}).notNull(),
 indexable:boolean('indexable').notNull().default(true),
 ogTitle:varchar('og_title',{length:200}).notNull().default(''),ogDescription:varchar('og_description',{length:500}).notNull().default(''),
 ogMediaId:bigint('og_media_id',{mode:'bigint',unsigned:true}).references(()=>mediaAssets.id,{onDelete:'restrict'}),
})
export const websitePageSeo=mysqlTable('website_page_seo',seoColumns(),t=>[primaryKey({name:'website_page_seo_pk',columns:[t.resourceId,t.locale]})])
export const websitePublishedSeo=mysqlTable('website_published_seo',seoColumns(),t=>[primaryKey({name:'website_published_seo_pk',columns:[t.resourceId,t.locale]})])
export const websiteSiteConfigReleases=mysqlTable('website_site_config_releases',{
 id:bigint('id',{mode:'bigint',unsigned:true}).primaryKey(),
 version:int('version',{unsigned:true}).notNull(),
 content:json('content').$type<import('#shared/types/website/site-config').WebsiteSiteConfigSnapshot>().notNull(),
 restoredFrom:bigint('restored_from',{mode:'bigint',unsigned:true}),
 createdBy:bigint('created_by',{mode:'bigint',unsigned:true}).notNull().references(()=>adminUsers.id,{onDelete:'restrict'}),
 createdAt:timestamp('created_at',{fsp:3}).notNull().defaultNow(),
})
export const websiteSiteConfig=mysqlTable('website_site_config',{
 id:int('id',{unsigned:true}).primaryKey(),version:int('version',{unsigned:true}).notNull().default(1),
 publishedReleaseId:bigint('published_release_id',{mode:'bigint',unsigned:true}),
},t=>[foreignKey({name:'website_site_config_publication',columns:[t.publishedReleaseId],foreignColumns:[websiteSiteConfigReleases.id]}).onDelete('restrict')])

// 当前站点的即时业务能力策略，与页面发布内容分离。
export const websiteModulePolicy=mysqlTable('website_module_policy',{
 id:tinyint('id',{unsigned:true}).primaryKey(),
 version:int('version',{unsigned:true}).notNull().default(1),
 policy:json('policy').$type<import('#shared/schemas/website/module-policy').WebsiteModulePolicy>().notNull(),
})

// 非区块模块（网站标识、新闻）使用的数据库图片规则。
export const websiteImageRules=mysqlTable('website_image_rules',{id:tinyint('id',{unsigned:true}).primaryKey(),rules:json('rules').$type<ModuleImageRules>().notNull()})

// 站点语言使用独立草稿、发布指针与历史；与路由共享事务协调锁。
export const websiteLanguageReleases=mysqlTable('website_language_releases',{
 id:bigint('id',{mode:'bigint',unsigned:true}).primaryKey(),version:int('version',{unsigned:true}).notNull(),
 content:json('content').$type<import('#shared/config/site-languages').SiteLanguages>().notNull(),
 restoredFrom:bigint('restored_from',{mode:'bigint',unsigned:true}),
 createdBy:bigint('created_by',{mode:'bigint',unsigned:true}).notNull().references(()=>adminUsers.id,{onDelete:'restrict'}),createdAt:timestamp('created_at',{fsp:3}).notNull().defaultNow(),
})
export const websiteLanguageConfig=mysqlTable('website_language_config',{
 id:int('id',{unsigned:true}).primaryKey(),version:int('version',{unsigned:true}).notNull().default(1),
 languages:json('languages').$type<import('#shared/config/site-languages').SiteLanguages>().notNull(),publishedReleaseId:bigint('published_release_id',{mode:'bigint',unsigned:true}),
},t=>[foreignKey({name:'website_language_publication',columns:[t.publishedReleaseId],foreignColumns:[websiteLanguageReleases.id]}).onDelete('restrict')])
