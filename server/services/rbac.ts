// 协调权限目录与关联业务规则、权限及持久化调用，不直接处理 HTTP 或 ORM。
import {matchesAdminPath} from '../policies/admin-route'
// 操作级授权：每次从数据库读取有效角色授权，客户端或 Session 缓存不构成权限依据。
import {randomUUID} from 'node:crypto'
import type {Database} from '../db/transaction'
import {rbacRepository} from '../repositories/rbac'
import {auditService} from './audit'
import {
    permissionCatalog,
    adminRoutePolicies,
    type PermissionDefinition,
    type AdminRoutePolicy
} from '../config/permissions'
import {ApiError} from '../core/errors'
import {menuRepository} from '../repositories/menus'

import {getPermissionSnapshot} from './access/permissions'

export function createRbacService(db: Database, catalog: readonly PermissionDefinition[] = permissionCatalog, policies: readonly AdminRoutePolicy[] = adminRoutePolicies) {
    // 重复目录/方法路由会产生含混策略，启动使用前即失败，而非取第一个宽松规则。
    if (new Set(catalog.map(item => item.code)).size !== catalog.length || new Set(policies.map(item => `${item.method}:${item.path}`)).size !== policies.length) throw new ApiError('INTERNAL_ERROR')
    if (catalog.some(item => !/^[a-z][a-z0-9_.]{2,79}$/.test(item.code) || !item.name || item.name.length > 80 || typeof item.available !== 'boolean')) throw new ApiError('INTERNAL_ERROR')
    if (policies.some(item => typeof item.enabled !== 'boolean' || !catalog.some(permission => permission.code === item.permission) || (item.self && (item.permission !== 'account.permissions.read' || item.method !== 'GET' || !['/api/admin/auth/permissions', '/api/admin/auth/navigation', '/api/admin/auth/preferences'].includes(item.path))))) throw new ApiError('INTERNAL_ERROR')
    const active = new Set(catalog.filter(item => item.available).map(item => item.code))

    async function snapshot(userId: bigint) {
        return getPermissionSnapshot(db, userId, catalog)
    }

    return {
        snapshot,
        async authorize(userId: bigint, method: string, path: string) {
            const policy = policies.find(item => item.method === method && matchesAdminPath(item.path, path))
            if (!policy?.enabled || !active.has(policy.permission)) throw new ApiError('FORBIDDEN')
            const current = await snapshot(userId)
            if (!policy.self && !current.isRoot && !current.permissions.includes(policy.permission)) throw new ApiError('FORBIDDEN')
        },
        async sync() {
            await db.transaction(async tx => {
                await rbacRepository.sync(tx, catalog)
                await menuRepository.sync(tx)
                await auditService.write(tx, {
                    actorId: null,
                    targetType: 'maintenance',
                    targetName: '权限与菜单目录',
                    action: 'rbac_sync',
                    result: 'success',
                    ip: 'local',
                    userAgent: 'internal-directory-sync',
                    requestId: randomUUID(),
                    createdAt: new Date()
                })
            })
            return {permissions: catalog.length}
        },
    }
}
