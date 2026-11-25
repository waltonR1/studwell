import {createRoleAuthorizationService} from '../../server/services/role-authorization'
import {afterAll, beforeAll, describe, expect, it, vi} from 'vitest'
import {and, desc, eq} from 'drizzle-orm'
import {setupTestDatabase, cleanTestDatabase} from './support'
import {seedRoot} from '../../scripts/database/seed/system'
import {createRbacService} from '../../server/services/rbac'
import {createRoleService} from '../../server/services/roles'
import {createUserService} from '../../server/services/users'
import {createMenuService} from '../../server/services/menus'
import {createDictionaryService} from '../../server/services/dictionaries'
import {createParameterService} from '../../server/services/parameters'
import {createTaskService} from '../../server/services/tasks'
import {createLogService} from '../../server/services/logs'
import {auditRepository} from '../../server/repositories/audit'
import {adminOperationLogs, adminRoles, adminUsers} from '../../server/db/schema'

let client: Awaited<ReturnType<typeof setupTestDatabase>>, root: bigint
const meta = {ip: '127.0.0.1', userAgent: 'changes-fixture', requestId: '00000000-0000-4000-8000-000000000001'}
const now = () => new Date()
async function latest(action: string, targetId: string) {
    const [row] = await client.database.select().from(adminOperationLogs).where(and(eq(adminOperationLogs.action, action), eq(adminOperationLogs.targetId, targetId))).orderBy(desc(adminOperationLogs.id)).limit(1)
    return row!
}
beforeAll(async () => {
    client = await setupTestDatabase()
    root = BigInt((await seedRoot(client.database, 'Audit fixture Aurora 8462!')).id)
    await client.database.update(adminUsers).set({mustChangePassword: false})
    await createRbacService(client.database).sync()
})
afterAll(async () => { if (client) { await cleanTestDatabase(client) } })

describe('业务变更贯穿事务、持久化、查询和导出', () => {
    it('角色改名准确记录旧值；相同保存为空差异；失败回滚没有成功明细', async () => {
        const roles = createRoleService(client.database)
        const {id} = await roles.create(root, {code: 'audit_changes', name: '旧角色名', enabled: true}, meta)
        await roles.update(root, id, {version: 1, name: '新角色名', enabled: true}, meta)
        const row = await latest('roles.update', id)
        expect(row.changeContext?.fields).toEqual([{field: 'name', before: '旧角色名', after: '新角色名'}])
        const logs = createLogService(client.database, now)
        expect((await logs.detail(root, 'audit', String(row.id))).changeContext).toEqual(row.changeContext)
        const list = await logs.list(root, 'audit', {period: '7d', action: 'roles.update'})
        expect(list.items.find(item => item.id === String(row.id))).toMatchObject({changeSummary: '修改：名称', changeContext: undefined})
        const file = await logs.export(root, 'audit', {period: '7d', action: 'roles.update'}, meta)
        expect(file.csv).toContain('名称：旧角色名 → 新角色名')
        await roles.update(root, id, {version: 2, name: '新角色名', enabled: true}, meta)
        expect((await latest('roles.update', id)).changeContext?.fields).toEqual([])
        const spy = vi.spyOn(auditRepository, 'audit').mockRejectedValueOnce(new Error('fixture audit failure'))
        try { await expect(roles.update(root, id, {version: 3, name: '不应保存', enabled: true}, meta)).rejects.toThrow() } finally { spy.mockRestore() }
        expect((await client.database.select().from(adminRoles).where(eq(adminRoles.id, BigInt(id))))[0]?.name).toBe('新角色名')
        expect(await latest('roles.update', id)).toMatchObject({result: 'failed', changeContext: null})
    })
    it('账号资料脱敏、角色集合与密码重置不记录密码', async () => {
        const users = createUserService(client.database, false), roles = createRoleService(client.database)
        const user = await users.create(root, {username: 'changes_subject', displayName: '原名', email: 'old@example.test', password: 'Audit fixture Aurora 8462!'}, meta)
        const updated = await users.update(root, user.id, {version: user.version, displayName: '新名', email: 'new@example.test', remark: '修改备注'}, meta)
        const changes = (await latest('users.update', user.id)).changeContext!
        expect(changes.fields).toContainEqual({field: 'displayName', before: '原名', after: '新名'})
        expect(changes.fields).toContainEqual({field: 'email', before: '已脱敏', after: '已脱敏'})
        expect(JSON.stringify(changes)).not.toMatch(/example|password|hash/)
        const role = await roles.create(root, {code: 'changes_assignment', name: '分配角色', enabled: true}, meta)
        const assigned = await users.assignRoles(root, user.id, {version: updated.version, roleIds: [role.id]}, meta)
        expect((await latest('users.roles', user.id)).changeContext?.fields).toContainEqual({field: 'roles', before: [], after: [{id: role.id, name: '分配角色'}]})
        await users.resetPassword(root, user.id, {version: assigned.version, password: 'Reset fixture Aurora 9832!'}, meta)
        const reset = (await latest('users.reset_password', user.id)).changeContext!
        expect(reset.fields).toContainEqual({field: 'passwordReset', before: null, after: '已重置（不记录密码内容）'})
        expect(JSON.stringify(reset)).not.toContain('Aurora')
    })
    it('字典、参数、任务配置记录实际生效变化', async () => {
        const dictionaries = createDictionaryService(client.database)
        const dictionary = await dictionaries.create(root, {code: 'changes_dictionary', name: '旧字典', description: '', enabled: true}, meta)
        await dictionaries.update(root, dictionary.id, {version: dictionary.version, name: '新字典', description: '', enabled: true}, meta)
        expect((await latest('dictionaries.update', dictionary.id)).changeContext?.fields).toContainEqual({field: 'name', before: '旧字典', after: '新字典'})
        const parameters = createParameterService(client.database)
        const parameter = (await parameters.list(root)).find(item => item.key === 'admin.list.defaultPageSize')!
        await parameters.update(root, parameter.id, {version: parameter.version, value: 20}, meta)
        const reset = await parameters.update(root, parameter.id, {version: parameter.version + 1, value: null}, meta)
        expect((await latest('parameters.reset', parameter.id)).changeContext?.fields).toContainEqual({field: 'override', before: 20, after: null})
        expect(reset.override).toBeNull()
        const tasks = createTaskService(client.database, {executionAllowed: false})
        const task = (await tasks.list(root)).find(item => item.code === 'log_cleanup')!
        await tasks.update(root, task.id, {version: task.version, schedule: {mode: 'daily', time: '03:17'}, retention: task.retention}, meta)
        expect((await latest('tasks.update', task.id)).changeContext?.fields).toContainEqual(expect.objectContaining({field: 'schedule', after: '每天 03:17（北京时间）'}))
    })
    it('角色统一授权分别记录权限和菜单增减；删除保留旧快照', async () => {
        const roles = createRoleService(client.database), menus = createMenuService(client.database)
        const role = await roles.create(root, {code: 'changes_grant', name: '授权角色', enabled: true}, meta)
        const menu = (await menus.list(root)).find(item => item.pageKey === 'users')!
        await createRoleAuthorizationService(client.database).assignRoleAuthorization(root, role.id, {version: 1, permissions: ['system.users.read'], menuIds: [menu.id]}, meta)
        expect((await latest('roles.permissions', role.id)).changeContext?.fields[0]).toMatchObject({field: 'permissions', before: [], after: [{id: 'system.users.read'}]})
        expect((await latest('roles.menus', role.id)).changeContext?.fields[0]).toMatchObject({field: 'menus', before: [], after: [{id: menu.id, name: menu.name}]})
        await roles.remove(root, role.id, {version: 2}, meta)
        expect((await latest('roles.delete', role.id)).changeContext).toMatchObject({mode: 'delete', fields: expect.arrayContaining([{field: 'name', before: '授权角色', after: null}])})
    })
})
