// 仅用于构建隔离权限或历史不一致数据；测试授权写入口时必须直接调用授权服务。
import type {Database} from '../../server/db/transaction'
import {roleRepository} from '../../server/repositories/roles'
import {menuRepository} from '../../server/repositories/menus'

export async function setRolePermissions(db: Database, actor: bigint, raw: string, input: {version: number; permissions: string[]}, _meta: unknown) {
    void _meta
    return db.transaction(async tx => {
        const id = BigInt(raw)
        if (!await roleRepository.replacePermissions(tx, id, input.permissions)) throw new Error('FIXTURE_PERMISSION_MISSING')
        if (!await roleRepository.update(tx, id, input.version, actor, {})) throw new Error('FIXTURE_VERSION_STALE')
    })
}
export async function setRoleMenus(db: Database, actor: bigint, raw: string, input: {version: number; menuIds: string[]}, _meta: unknown) {
    void _meta
    return db.transaction(async tx => {
        const id = BigInt(raw)
        await menuRepository.replace(tx, id, input.menuIds.map(BigInt))
        if (!await roleRepository.update(tx, id, input.version, actor, {})) throw new Error('FIXTURE_VERSION_STALE')
    })
}
