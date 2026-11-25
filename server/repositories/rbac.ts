// 负责权限目录与关联的数据库查询与持久化，使用调用方传入的执行器，不决定 HTTP 响应或业务授权。
import {withEntityIds} from '../db/allocate-entity-id'
// RBAC 持久化及增量同步：不决定 HTTP 或业务授权，所有写入使用调用方事务。
import {and, eq, inArray} from 'drizzle-orm'
import {adminPermissions, adminRoles, adminRolePermissions, adminUserRoles} from '../db/schema'
import type {DatabaseExecutor} from '../db/transaction'
import type {PermissionDefinition} from '../config/permissions'

export const rbacRepository = {
    async effective(db: DatabaseExecutor, userId: bigint) {
        return db.select({code: adminPermissions.code}).from(adminUserRoles)
            .innerJoin(adminRoles, eq(adminRoles.id, adminUserRoles.roleId))
            .innerJoin(adminRolePermissions, eq(adminRolePermissions.roleId, adminRoles.id))
            .innerJoin(adminPermissions, eq(adminPermissions.id, adminRolePermissions.permissionId))
            .where(and(eq(adminUserRoles.userId, userId), eq(adminRoles.enabled, true), eq(adminPermissions.available, true)))
    },
    async sync(db: DatabaseExecutor, catalog: readonly PermissionDefinition[]) {
        const existing = await db.select().from(adminPermissions)
        const byCode = new Map(existing.map(row => [row.code, row]))
        for (const item of catalog) {
            const current = byCode.get(item.code)
            if (current) {
                await db.update(adminPermissions).set({name: item.name, available: item.available}).where(eq(adminPermissions.id, current.id))
                continue
            }
            await db.insert(adminPermissions).values(await withEntityIds(db, 'admin_permissions', item)).onDuplicateKeyUpdate({
                set: {
                    name: item.name,
                    available: item.available
                }
            })
        }
        const obsolete = existing.filter(item => !catalog.some(entry => entry.code === item.code)).map(item => item.id)
        if (obsolete.length) await db.update(adminPermissions).set({available: false}).where(inArray(adminPermissions.id, obsolete))
        // 普通角色由管理员自行创建；同步不创建或修改角色及账号关联。
    },
}
