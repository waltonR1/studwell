// 实体类型码是持久化 ID 的一部分；重新编号须同步迁移主键、引用和计数器。
export const entityIdTypes = {
    admin_users: '01',
    admin_roles: '02',
    admin_permissions: '03',
    admin_menus: '04',
    admin_parameters: '05',
    admin_dictionaries: '06',
    admin_dictionary_items: '07',
    admin_sessions: '08',
    admin_auth_logs: '09',
    admin_operation_logs: '10',
    admin_tasks: '11',
    admin_task_runs: '12',
    admin_task_commands: '13',
    media_assets: '14',
    media_references: '15',
    website_navigation: '16',
    website_releases: '17',
    website_resources: '18',
    website_templates: '19',
    website_sections: '20',
    news_categories: '21',
    news_articles: '22',
    news_releases: '23',
    career_positions: '24',
    career_position_releases: '25',
    customer_inquiries: '26',
    customer_inquiry_events: '27',
    customer_inquiry_mail: '28',
    website_site_config_releases: '29',
    website_language_releases: '30',
} as const

export type EntityTable = keyof typeof entityIdTypes

export function decodeEntityId(value: string) {
    if (!/^[1-9]\d{18}$/.test(value)) return null
    const date = value.slice(0, 8), type = value.slice(8, 10), sequence = value.slice(10)
    const table = (Object.keys(entityIdTypes) as EntityTable[]).find(key => entityIdTypes[key] === type)
    const day = new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T00:00:00Z`)
    if (!table || sequence === '000000000' || !Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10).replaceAll('-', '') !== date) return null
    return {date, type, table, sequence}
}
