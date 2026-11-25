import {seedReferenceBusiness} from '../fixtures/reference-seed'
import {eq, sql} from 'drizzle-orm'
import type {Database} from '../../server/db/transaction'
import {adminUsers} from '../../server/db/schema'
import {withEntityIds} from '../../server/db/allocate-entity-id'
import {taskSeedDefaults} from '../../scripts/database/seed/system'
import {seedSystemRows} from '../../scripts/database/seed/system'
import {rbacRepository} from '../../server/repositories/rbac'
import {menuRepository} from '../../server/repositories/menus'
import {permissionCatalog} from '../../server/config/permissions'

// 仅供数据库自动化测试在已核验的专用测试库内调用。
// 固定清理范围；全部 DML 在同一事务内，Root 凭据保留，所有实体重新编号。
export async function resetTestData(db: Database) {
    return db.transaction(async tx => {
        const [root] = await tx.select().from(adminUsers).where(eq(adminUsers.isRoot, true)).for('update')
        await tx.execute(sql`DELETE FROM customer_inquiry_mail`)
        await tx.execute(sql`DELETE FROM customer_inquiry_events`)
        await tx.execute(sql`DELETE FROM customer_inquiries`)
        await tx.execute(sql`UPDATE customer_inquiry_settings SET settings=JSON_SET(settings, '$.mail.forwardEnabled', CAST('false' AS JSON), '$.mail.replyEnabled', CAST('false' AS JSON)), version=version+1 WHERE id=1`)
        await tx.execute(sql`UPDATE news_articles SET published_release_id=NULL`)
        await tx.execute(sql`UPDATE news_releases SET restored_from=NULL`)
        await tx.execute(sql`DELETE FROM news_releases`)
        await tx.execute(sql`DELETE FROM news_articles`)
        await tx.execute(sql`DELETE FROM news_categories`)
        await tx.execute(sql`UPDATE news_operations SET view_count_enabled=FALSE,version=1 WHERE id=1`)
        await tx.execute(sql`DELETE FROM website_language_config`)
        await tx.execute(sql`DELETE FROM website_language_releases`)
        await tx.execute(sql`DELETE FROM website_site_config`)
        await tx.execute(sql`DELETE FROM website_site_config_releases`)
        await tx.execute(sql`DELETE FROM website_published_seo`)
        await tx.execute(sql`DELETE FROM website_page_seo`)
        await tx.execute(sql`DELETE FROM website_published_routes`)
        await tx.execute(sql`UPDATE website_route_nodes SET parent_id=NULL`)
        await tx.execute(sql`DELETE FROM website_route_nodes`)
        await tx.execute(sql`UPDATE website_resources SET published_release_id=NULL`)
        await tx.execute(sql`UPDATE website_releases SET restored_from=NULL`)
        await tx.execute(sql`DELETE FROM website_releases`)
        await tx.execute(sql`DELETE FROM website_sections`)
        await tx.execute(sql`DELETE FROM website_drafts`)
        await tx.execute(sql`DELETE FROM website_navigation WHERE parent_id IS NOT NULL`)
        await tx.execute(sql`DELETE FROM website_navigation`)
        for (const table of [
            'media_references', 'website_resources', 'website_templates', 'media_assets',
            'admin_task_commands', 'admin_task_runs', 'admin_tasks',
            'admin_dictionary_items', 'admin_dictionaries', 'admin_parameters',
            'admin_role_menus', 'admin_user_roles', 'admin_role_permissions',
            'admin_operation_logs', 'admin_sessions', 'admin_auth_logs', 'admin_rate_limits',
        ]) await tx.execute(sql.raw(`DELETE FROM ${table}`))
        await tx.execute(sql`UPDATE admin_menus SET parent_id = NULL`)
        await tx.execute(sql`DELETE FROM admin_menus`)
        await tx.execute(sql`DELETE FROM admin_permissions`)
        await tx.execute(sql`DELETE FROM admin_roles`)
        await tx.execute(sql`UPDATE admin_users SET created_by = NULL, updated_by = NULL`)
        await tx.execute(sql`DELETE FROM admin_users`)
        // 保留计数器高水位，防止同日重建复用旧编号、误命中浏览器缓存或历史链接。
        if (root) await tx.insert(adminUsers).values(await withEntityIds(tx, 'admin_users', {
            username: 'root', displayName: root.displayName, passwordHash: root.passwordHash,
            isRoot: true, mustChangePassword: root.mustChangePassword,
            email: root.email, phone: root.phone, department: root.department,
            position: root.position, remark: root.remark,
        }))
        await seedSystemRows(tx)
        await seedReferenceBusiness(tx,{dictionaryItems:true})
        await rbacRepository.sync(tx, permissionCatalog)
        await menuRepository.sync(tx)
        return {rootPreserved: Boolean(root), tasks: Object.keys(taskSeedDefaults).length}
    })
}
