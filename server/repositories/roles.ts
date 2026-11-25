// 负责角色的数据库查询与持久化，使用调用方传入的执行器，不决定 HTTP 响应或业务授权。
import {MAX_ENTITY_VERSION} from '#shared/config/entity-versions'
import {withEntityIds} from '../db/allocate-entity-id'
// 角色查询、持久化与审计；不决定业务授权，不隐式切换传入事务。
import {and, asc, count, desc, eq, inArray, isNull, like, or, sql, lt} from 'drizzle-orm'
import {adminPermissions, adminRoles, adminRolePermissions, adminUserRoles, adminUsers, adminRoleMenus} from '../db/schema'
import type {DatabaseExecutor} from '../db/transaction'

export const roleRepository = {
    async list(db: DatabaseExecutor, query: { page: number; pageSize: number; search?: string; status?: string }) {
        const keyword = query.search?.replace(/[\\%_]/g, '\\$&')
        const filter = and(query.status ? eq(adminRoles.enabled, query.status === 'enabled') : undefined, keyword ? or(like(adminRoles.name, `%${keyword}%`), like(adminRoles.code, `%${keyword}%`)) : undefined)
        const items = await db.select().from(adminRoles).where(filter).orderBy(desc(adminRoles.createdAt), desc(adminRoles.id)).limit(query.pageSize).offset((query.page - 1) * query.pageSize)
        const [total] = await db.select({value: count()}).from(adminRoles).where(filter)
        // 当前页一次分组聚合；禁用账号仍是关联，软删除账号不计入。
        const counts = items.length ? await db.select({
            roleId: adminUserRoles.roleId,
            value: count()
        }).from(adminUserRoles).innerJoin(adminUsers, eq(adminUsers.id, adminUserRoles.userId)).where(and(inArray(adminUserRoles.roleId, items.map(item => item.id)), isNull(adminUsers.deletedAt))).groupBy(adminUserRoles.roleId) : []
        const byRole = new Map(counts.map(row => [row.roleId, Number(row.value)]))
        return {
            items: items.map(row => ({...row, userCount: byRole.get(row.id) ?? 0})),
            total: total!.value,
            page: query.page,
            pageSize: query.pageSize
        }
    },
    async find(db: DatabaseExecutor, id: bigint, lock = false) {
        const query = db.select().from(adminRoles).where(eq(adminRoles.id, id)).limit(1)
        const [row] = await (lock ? query.for('update') : query)
        return row
    },
    async insert(db: DatabaseExecutor, input: {
        code: string;
        name: string;
        enabled: boolean;
        createdBy: bigint | null;
        updatedBy: bigint | null
    }) {
        await db.insert(adminRoles).values(await withEntityIds(db, 'admin_roles', input))
        const [row] = await db.select({id: adminRoles.id}).from(adminRoles).where(eq(adminRoles.code, input.code)).limit(1)
        return row!.id
    },
    async update(db: DatabaseExecutor, id: bigint, version: number, actor: bigint, fields: {
        name?: string;
        enabled?: boolean
    }) {
        const [result] = await db.update(adminRoles).set({
            ...fields,
            updatedBy: actor,
            updatedAt: new Date(),
            version: sql`${adminRoles.version}
            + 1`
        }).where(and(eq(adminRoles.id, id), eq(adminRoles.version, version), lt(adminRoles.version, MAX_ENTITY_VERSION)))
        return result.affectedRows === 1
    },
    async permissionsForRoles(db: DatabaseExecutor, ids: bigint[]) {
        return ids.length ? db.select({roleId: adminRolePermissions.roleId, code: adminPermissions.code})
            .from(adminRolePermissions).innerJoin(adminPermissions, eq(adminPermissions.id, adminRolePermissions.permissionId))
            .where(inArray(adminRolePermissions.roleId, ids)) : []
    },
    async permissionCodes(db: DatabaseExecutor, roleId: bigint) {
        return (await db.select({code: adminPermissions.code}).from(adminRolePermissions).innerJoin(adminPermissions, eq(adminPermissions.id, adminRolePermissions.permissionId)).where(eq(adminRolePermissions.roleId, roleId)).orderBy(asc(adminPermissions.code))).map(row => row.code)
    },
    async replacePermissions(db: DatabaseExecutor, roleId: bigint, codes: string[]) {
        const records = codes.length ? await db.select().from(adminPermissions).where(inArray(adminPermissions.code, codes)) : []
        if (records.length !== codes.length) return false
        await db.delete(adminRolePermissions).where(eq(adminRolePermissions.roleId, roleId))
        if (records.length) await db.insert(adminRolePermissions).values(records.map(row => ({
            roleId,
            permissionId: row.id
        })))
        return true
    },
    async referenced(db: DatabaseExecutor, id: bigint) {
        const [row] = await db.select({userId: adminUserRoles.userId}).from(adminUserRoles).where(eq(adminUserRoles.roleId, id)).limit(1)
        return !!row
    },
    async remove(db: DatabaseExecutor, id: bigint) {
        await db.delete(adminRoleMenus).where(eq(adminRoleMenus.roleId, id))
        await db.delete(adminRolePermissions).where(eq(adminRolePermissions.roleId, id))
        await db.delete(adminRoles).where(eq(adminRoles.id, id))
    },
}
