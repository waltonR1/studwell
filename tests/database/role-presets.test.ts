import { auditRepository } from '../../server/repositories/audit'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { setupTestDatabase, cleanTestDatabase } from './support'
import {seedRoot} from '../../scripts/database/seed/system'
import {createAccountService} from '../../server/services/accounts'
import {createRbacService} from '../../server/services/rbac'
import {getPermissionSnapshot} from '../../server/services/access/permissions'
import { seedPresetRoles } from '../../scripts/database/seed/samples'
import { rolePresets } from '../../scripts/database/seed/samples'
import { roleRepository } from '../../server/repositories/roles'
import { menuRepository } from '../../server/repositories/menus'
import { createMenuService } from '../../server/services/menus'
import { adminRoles, adminRolePermissions, adminRoleMenus, adminUserRoles, adminUsers } from '../../server/db/schema'
let client: Awaited<ReturnType<typeof setupTestDatabase>>, root: bigint
beforeAll(async () => { client = await setupTestDatabase() })
afterAll(async () => { if (client) await cleanTestDatabase(client) })
describe('显式预设角色初始化', () => {
  it('缺少 Root 或未同步菜单时拒绝，不写入角色', async () => {
    await expect(seedPresetRoles(client.database)).rejects.toThrow('ROLE_PRESETS_ROOT_REQUIRED')
    root = BigInt((await seedRoot(client.database, 'Preset fixture Aurora 80246!')).id)
    await expect(seedPresetRoles(client.database)).rejects.toThrow('ROLE_PRESETS_MENU_REQUIRED')
    expect(await client.database.select().from(adminRoles)).toEqual([])
    await createRbacService(client.database).sync()
    expect(await client.database.select().from(adminRoles)).toEqual([])
  })
  it('首次登录前创建完整角色，不改 Root、不建账号或关联用户', async () => {
    const [before] = await client.database.select().from(adminUsers).where(eq(adminUsers.id, root))
    expect(before!.mustChangePassword).toBe(true)
    expect(await seedPresetRoles(client.database)).toEqual({ created: rolePresets.map(role => role.code), skipped: [] })
    expect(await client.database.select().from(adminUsers)).toEqual([before])
    expect(await client.database.select().from(adminUserRoles)).toEqual([])
    const rows = await client.database.select().from(adminRoles), menus = await menuRepository.all(client.database)
    expect(rows).toHaveLength(rolePresets.length)
    for (const preset of rolePresets) {
      const role = rows.find(row => row.code === preset.code)!
      expect(role).toMatchObject({ name: preset.name, enabled: true, createdBy: null, updatedBy: null })
      expect((await roleRepository.permissionCodes(client.database, role.id)).sort()).toEqual([...preset.permissions].sort())
      expect((await menuRepository.roleIds(client.database, role.id)).map(id => menus.find(menu => menu.id === id)!.pageKey).sort()).toEqual(menus.filter(menu=>preset.pageKeys.some(key=>key===menu.pageKey)).map(menu=>menu.pageKey).sort())
    }
    const audit = rolePresets.find(role => role.code === 'audit_reader')!
    expect(audit.permissions.some(code => code.includes('sources') || code.endsWith('.export'))).toBe(false)
  })
  it('预设审计角色实际只有三类日志入口，不能获得配置或来源能力', async () => {
    const user = await createAccountService(client.database, false).createOrdinary({ username: 'preset_reader', displayName: 'Reader', password: 'Preset reader Aurora 80426!' }, String(root))
    await client.database.update(adminUsers).set({ mustChangePassword: false }).where(eq(adminUsers.id, BigInt(user.id)))
    const [role] = await client.database.select().from(adminRoles).where(eq(adminRoles.code, 'audit_reader'))
    await client.database.insert(adminUserRoles).values({ userId: BigInt(user.id), roleId: role!.id })
    const snapshot = await getPermissionSnapshot(client.database, BigInt(user.id))
    expect(snapshot.isRoot).toBe(false)
    expect(snapshot.permissions).not.toContain('system.parameters.update')
    expect(snapshot.permissions.some(code => code.includes('sources') || code.endsWith('.export'))).toBe(false)
    expect((await createMenuService(client.database).navigation(BigInt(user.id))).items.filter(item => item.path).map(item => item.code).sort()).toEqual(['audit_logs', 'login_logs', 'security_logs'])
    await client.database.delete(adminUserRoles).where(eq(adminUserRoles.userId, BigInt(user.id)))
  })
  it('重跑保留同编码名称、禁用状态、权限和菜单；日常同步不补回已删除角色', async () => {
    const [config] = await client.database.select().from(adminRoles).where(eq(adminRoles.code, 'system_configurator'))
    await client.database.update(adminRoles).set({ name: '人工配置员', enabled: false, version: 5 }).where(eq(adminRoles.id, config!.id))
    await roleRepository.replacePermissions(client.database, config!.id, ['system.dashboard.read'])
    await menuRepository.replace(client.database, config!.id, [])
    const before = await client.database.select().from(adminRoles), beforePermissions = await client.database.select().from(adminRolePermissions), beforeMenus = await client.database.select().from(adminRoleMenus)
    expect(await seedPresetRoles(client.database)).toEqual({ created: [], skipped: rolePresets.map(role => role.code) })
    expect(await client.database.select().from(adminRoles)).toEqual(before)
    expect(await client.database.select().from(adminRolePermissions)).toEqual(beforePermissions)
    expect(await client.database.select().from(adminRoleMenus)).toEqual(beforeMenus)
    const reader = before.find(role => role.code === 'audit_reader')!
    await roleRepository.remove(client.database, reader.id)
    await createRbacService(client.database).sync()
    expect(await client.database.select().from(adminRoles).where(eq(adminRoles.code, 'audit_reader'))).toEqual([])
    expect(await seedPresetRoles(client.database)).toEqual({ created: ['audit_reader'], skipped: ['platform_admin', 'system_configurator', 'task_operator'] })
  })
  it('审计失败整批回滚，不留下半授权角色', async () => {
    for (const row of await client.database.select().from(adminRoles)) await roleRepository.remove(client.database, row.id)
    const audit = vi.spyOn(auditRepository, 'audit').mockRejectedValueOnce(new Error('preset audit failure'))
    try { await expect(seedPresetRoles(client.database)).rejects.toThrow('preset audit failure') } finally { audit.mockRestore() }
    expect(await client.database.select().from(adminRoles)).toEqual([])
    expect(await client.database.select().from(adminRolePermissions)).toEqual([])
    expect(await client.database.select().from(adminRoleMenus)).toEqual([])
  })
})
