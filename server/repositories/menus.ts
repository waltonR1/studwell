// 负责菜单的数据库查询与持久化，使用调用方传入的执行器，不决定 HTTP 响应或业务授权。
import {MAX_ENTITY_VERSION} from '#shared/config/entity-versions'
import {withEntityIds} from '../db/allocate-entity-id'
// 菜单持久化：事务执行器由 Service 传入；锁全树使并发移动可串行校验。
import {and, asc, eq, inArray, sql, lt} from 'drizzle-orm'
import {adminMenus, adminRoleMenus, adminRoles, adminUserRoles} from '../db/schema'
import type {DatabaseExecutor} from '../db/transaction'
import {initialMenus, menuPageCatalog, MAX_MENU_DEPTH} from '../config/menus'

export const menuRepository = {
    async bindingsForMenu(db:DatabaseExecutor,menuId:bigint){return db.select({roleId:adminRoleMenus.roleId}).from(adminRoleMenus).where(eq(adminRoleMenus.menuId,menuId)).orderBy(adminRoleMenus.roleId)},
    async removeMenuBindings(db:DatabaseExecutor,menuId:bigint){await db.delete(adminRoleMenus).where(eq(adminRoleMenus.menuId,menuId))},
    async byCode(db: DatabaseExecutor, code: string, lock = false) {
        const query = db.select().from(adminMenus).where(eq(adminMenus.code, code)).limit(1)
        const [row] = await (lock ? query.for('update') : query)
        return row ?? null
    },
    async all(db: DatabaseExecutor, lock = false) {
        const query = db.select().from(adminMenus).orderBy(asc(adminMenus.id))
        return lock ? query.for('update') : query
    },
    async insert(db: DatabaseExecutor, input: typeof adminMenus.$inferInsert) {
        await db.insert(adminMenus).values(await withEntityIds(db, 'admin_menus', input))
        const [row] = await db.select({id: adminMenus.id}).from(adminMenus).where(eq(adminMenus.code, input.code))
        return row!.id
    },
    async update(db: DatabaseExecutor, id: bigint, version: number, actor: bigint, fields: {
        iconKey?: string;
        name: string;
        parentId: bigint | null;
        sortOrder: number;
        visible: boolean
    }) {
        const [result] = await db.update(adminMenus).set({
            ...fields,
            updatedBy: actor,
            updatedAt: new Date(),
            version: sql`${adminMenus.version}
            + 1`
        }).where(and(eq(adminMenus.id, id), eq(adminMenus.version, version), lt(adminMenus.version, MAX_ENTITY_VERSION)))
        return result.affectedRows === 1
    },
    async referenced(db: DatabaseExecutor, id: bigint) {
        return (await db.select().from(adminRoleMenus).where(eq(adminRoleMenus.menuId, id)).limit(1)).length > 0
    },
    async remove(db: DatabaseExecutor, id: bigint) {
        await db.delete(adminMenus).where(eq(adminMenus.id, id))
    },
    async assigned(db: DatabaseExecutor, userId: bigint) {
        return (await db.select({id: adminRoleMenus.menuId}).from(adminUserRoles).innerJoin(adminRoles, eq(adminRoles.id, adminUserRoles.roleId)).innerJoin(adminRoleMenus, eq(adminRoleMenus.roleId, adminRoles.id)).where(and(eq(adminUserRoles.userId, userId), eq(adminRoles.enabled, true)))).map(row => row.id)
    },
    async bindingsForRoles(db: DatabaseExecutor, ids: bigint[]) {
        return ids.length ? db.select().from(adminRoleMenus).where(inArray(adminRoleMenus.roleId, ids)) : []
    },
    async roleIds(db: DatabaseExecutor, roleId: bigint) {
        return (await db.select({id: adminRoleMenus.menuId}).from(adminRoleMenus).where(eq(adminRoleMenus.roleId, roleId))).map(row => row.id)
    },
    async replace(db: DatabaseExecutor, roleId: bigint, ids: bigint[]) {
        await db.delete(adminRoleMenus).where(eq(adminRoleMenus.roleId, roleId))
        if (ids.length) await db.insert(adminRoleMenus).values(ids.map(menuId => ({roleId, menuId})))
    },
    async sync(db: DatabaseExecutor) {
        // 只插入缺失项，绝不覆盖名称、父级、顺序、可见性或授权。
        const rows = await db.select().from(adminMenus).orderBy(asc(adminMenus.id)).for('update')
        for (const {parentCode, ...item} of initialMenus) {
            const existing = rows.find(row => row.code === item.code)
            if (existing) continue
            if (item.pageKey && !menuPageCatalog.find(page=>page.key===item.pageKey)?.repeatable && rows.some(row => row.pageKey === item.pageKey)) continue
            const parent = parentCode ? rows.find(row => row.code === parentCode && (row.pageKey === null || row.pageKey === 'website_page')) : undefined
            let cursor = parent, validParent = true
            const ancestors = new Set<bigint>()
            while (cursor) {
                if ((cursor.pageKey !== null && cursor.pageKey !== 'website_page') || ancestors.has(cursor.id) || ancestors.size >= MAX_MENU_DEPTH - 1) {
                    validParent = false;
                    break
                }
                ancestors.add(cursor.id)
                const parentId = cursor.parentId
                cursor = parentId === null ? undefined : rows.find(row => row.id === parentId)
                if (parentId !== null && !cursor) validParent = false
            }
            // 管理员可能把默认目录移到最深层；只给新项选择合法父级，不改旧树。
            await db.insert(adminMenus).values(await withEntityIds(db, 'admin_menus', {
                ...item,
                parentId: validParent ? parent?.id ?? null : null
            })).onDuplicateKeyUpdate({set: {code: sql`${adminMenus.code}`}})
            const [created] = await db.select().from(adminMenus).where(eq(adminMenus.code, item.code))
            if (created) rows.push(created)
        }
    },
}

export type MenuRow = typeof adminMenus.$inferSelect
