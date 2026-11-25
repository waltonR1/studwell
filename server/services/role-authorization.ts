// 协调角色联合授权业务规则、权限及持久化调用，不直接处理 HTTP 或 ORM。
import {auditedWrite, type AuditedResult} from './operations/audited-write'
import {validateRoleAuthorization} from '../policies/role-authorization'
import {requirePermission as checkPermission} from './access/permissions'
import type {Database, DatabaseExecutor, DatabaseTransaction} from '../db/transaction'
import type {AuthMeta} from '../core/auth-context'
import {roleAuthorizationSchema} from '#shared/schemas/admin/roles'
import {getPermissionSnapshot, assertPermission} from './access/permissions'
import {menuRepository as repo, type MenuRow} from '../repositories/menus'
import {roleRepository} from '../repositories/roles'
import {menuPageCatalog} from '../config/menus'
import {permissionCatalog} from '../config/permissions'
import {ApiError, conflictError} from '../core/errors'
import {entityIdSchema} from '#shared/schemas/entity'
import {parseInput} from '../core/validation'
import {auditService} from './audit'
import {auditChanges, auditReferences} from '../policies/audit-changes'
import {page, ordered, validateTree} from '../policies/menu-model'
import {dto} from './menus/mapper'

// 角色授权唯一写入入口；所有提交方式在同一事务中检查最终授权组合。
export function createRoleAuthorizationService(database: Database) {
    const requirePermission = (actor: bigint, permission: string, executor: DatabaseExecutor = database) => checkPermission(executor, actor, permission)

    const write = <T>(actor: bigint, meta: AuthMeta, action: string, id: bigint | null, work: (tx: DatabaseTransaction) => Promise<AuditedResult<T>>) =>
        auditedWrite(database, {actor, meta, action, id, targetType: 'role'}, work)

    async function options(executor: DatabaseExecutor, actor: bigint, current: Awaited<ReturnType<typeof getPermissionSnapshot>>, rows: MenuRow[]) {
        const assigned = new Set((await repo.assigned(executor, actor)).map(String))
        return rows.map(row => ({
            ...dto(row),
            permission: page(row.pageKey)?.permission ?? null,
            operations: page(row.pageKey)?.operations ?? [],
            grantable: !!page(row.pageKey) && (current.isRoot || (assigned.has(String(row.id)) && current.permissions.includes(page(row.pageKey)!.permission)))
        }))
    }

    async function assignRoleAuthorization(actor: bigint, raw: string, input: unknown, meta: AuthMeta) {
        const id = BigInt(await parseInput(entityIdSchema, raw)),
            data = await parseInput(roleAuthorizationSchema, input)
        return write(actor, meta, 'roles.permissions', id, async tx => {
            const current = await getPermissionSnapshot(tx, actor)
            if (!current.isRoot && !current.permissions.some(code => ['system.roles.assign_permissions', 'system.roles.assign_menus'].includes(code))) throw new ApiError('FORBIDDEN')
            const row = await roleRepository.find(tx, id, true)
            if (!row) throw new ApiError('NOT_FOUND')
            if (row.version !== data.version) throw conflictError('STALE', 'version')
            const previousPermissions = await roleRepository.permissionCodes(tx, id),
                previousMenus = (await repo.roleIds(tx, id)).map(String)
            const permissions = data.permissions
            const menuIds = data.menuIds
            const differs = (a: string[], b: string[]) => JSON.stringify([...a].sort()) !== JSON.stringify([...b].sort())
            const permissionsChanged = differs(previousPermissions, permissions),
                menusChanged = differs(previousMenus, menuIds)
            if (!current.isRoot && previousPermissions.some(code => !current.permissions.includes(code))) throw new ApiError('FORBIDDEN')
            if (permissionsChanged) assertPermission(current, 'system.roles.assign_permissions')
            if (menusChanged) assertPermission(current, 'system.roles.assign_menus')
            const allowedPermissions = new Set(permissionCatalog.filter(item => item.available && item.code !== 'account.permissions.read' && (current.isRoot || current.permissions.includes(item.code))).map(item => item.code))
            if (permissions.some(code => !allowedPermissions.has(code))) throw new ApiError('FORBIDDEN')
            const rows = await repo.all(tx, true);
            validateTree(rows)
            const allowedMenus = new Set((await options(tx, actor, current, rows)).filter(item => item.grantable).map(item => item.id))
            if (menusChanged && ((!current.isRoot && previousMenus.some(key => !allowedMenus.has(key))) || menuIds.some(key => !previousMenus.includes(key) && !allowedMenus.has(key)))) throw new ApiError('FORBIDDEN')
            validateRoleAuthorization(permissions, menuIds, rows)
            if (permissionsChanged && !await roleRepository.replacePermissions(tx, id, permissions)) throw new ApiError('FORBIDDEN')
            if (menusChanged) await repo.replace(tx, id, menuIds.map(BigInt))
            if (!await roleRepository.update(tx, id, data.version, actor, {})) throw conflictError('STALE', 'version')
            await auditService.write(tx, {
                ...meta,
                actorId: actor,
                action: 'roles.menus',
                changeContext: auditChanges('role', {menus: auditReferences(previousMenus, rows)}, {menus: auditReferences(menuIds, rows)}),
                targetType: 'role',
                targetId: String(id),
                targetName: row.name,
                result: 'success',
                createdAt: new Date()
            })
            return {value: {version: data.version + 1}, id, name: row.name, changes: auditChanges('role', {permissions: auditReferences(previousPermissions, permissionCatalog.map(item => ({id: item.code, name: item.name})))}, {permissions: auditReferences(permissions, permissionCatalog.map(item => ({id: item.code, name: item.name})))})}
        })
    }

    return {
        async roleMenus(actor: bigint, raw: string) {
            const current = await requirePermission(actor, 'system.roles.read'),
                id = BigInt(await parseInput(entityIdSchema, raw))
            const row = await roleRepository.find(database, id)
            if (!row) throw new ApiError('NOT_FOUND')
            const rows = await repo.all(database);
            validateTree(rows)
            return {
                version: row.version,
                menuIds: (await repo.roleIds(database, id)).map(String),
                pages: menuPageCatalog,
                items: await options(database, actor, current, ordered(rows))
            }
        },
        assignRoleAuthorization,
    }
}
