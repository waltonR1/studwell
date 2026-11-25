// 读取权限快照并复核操作者权限，供业务事务授权使用。
import {createHash} from 'node:crypto'
import type {DatabaseExecutor} from '../../db/transaction'
import {accountRepository} from '../../repositories/accounts'
import {rbacRepository} from '../../repositories/rbac'
import {permissionCatalog, type PermissionDefinition} from '../../config/permissions'
import {ApiError} from '../../core/errors'

// 写业务可在同一事务中复核授权，避免持有事务连接后再申请全局连接。
export async function getPermissionSnapshot(db: DatabaseExecutor, userId: bigint, catalog: readonly PermissionDefinition[] = permissionCatalog) {
    const user = await accountRepository.findById(db, userId)
    if (!user?.enabled || user.deletedAt) throw new ApiError('UNAUTHENTICATED')
    if (user.mustChangePassword) throw new ApiError('PASSWORD_CHANGE_REQUIRED')
    const active = new Set(catalog.filter(item => item.available).map(item => item.code))
    const granted = user.isRoot ? [...active] : (await rbacRepository.effective(db, userId)).map(item => item.code)
    const permissions = [...new Set([...granted, ...(active.has('account.permissions.read') ? ['account.permissions.read'] : [])])].filter(code => active.has(code)).sort()
    return {
        permissions,
        isRoot: user.isRoot,
        version: createHash('sha256').update(JSON.stringify({permissions, isRoot: user.isRoot})).digest('hex')
    }
}

export async function requirePermission(db: DatabaseExecutor, actor: bigint, permission: string) {
    const current = await getPermissionSnapshot(db, actor)
    assertPermission(current, permission)
    return current
}

export function assertPermission(current: Awaited<ReturnType<typeof getPermissionSnapshot>>, permission: string) {
    if (!current.isRoot && !current.permissions.includes(permission)) throw new ApiError('FORBIDDEN')
}
