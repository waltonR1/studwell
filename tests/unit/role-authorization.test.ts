import { describe, expect, it } from 'vitest'
import { requiredMenuPermissions, removableMenuPermissions } from '../../app/utils/admin/roles/authorization'
import { menuPageCatalog } from '../../server/config/menus'
import { permissionCatalog } from '../../server/config/permissions'
import { menuPageOptions } from '../../app/utils/admin/menus/page-options'
import { roleAuthorizationSchema } from '../../shared/schemas/admin/roles'
import type { RoleMenuOption } from '../../shared/types/admin/menus'
const items = [
  { id: '1', pageKey: 'website_page', permission: 'content.pages.read', operations: ['content.pages.read'] },
  { id: '2', pageKey: 'website_page', permission: 'content.pages.read', operations: ['content.pages.read'] },
] as RoleMenuOption[]
const catalog = [{ code: 'content.pages.read', name: '网页维护', available: true, grantable: true }]
describe('页面关联授权', () => {
  it('映射显式登记且只引用有效操作，必要查看权限包含在操作集合', () => {
    for (const page of menuPageCatalog) {
      expect(page.operations).toContain(page.permission)
      expect(new Set(page.operations).size).toBe(page.operations!.length)
      for (const code of page.operations!) expect(permissionCatalog.some(item => item.code === code && item.available)).toBe(true)
    }
  })
  it('后台首页是内置入口，不允许在菜单新增中重复绑定', () => {
    const pages = menuPageCatalog.map(page => ({ ...page, grantable: true }))
    expect(pages.find(page => page.key === 'dashboard')).toMatchObject({ builtin: true })
    expect(menuPageOptions(pages, []).some(item => item.value === 'dashboard')).toBe(false)
  })
  it('必需权限去重，清理时保留其他通配入口的依赖', () => {
    expect(requiredMenuPermissions(items, ['1', '2'])).toEqual(['content.pages.read'])
    expect(removableMenuPermissions(items[0]!, items, ['2'], catalog, ['content.pages.read'])).toEqual([])
    expect(removableMenuPermissions(items[0]!, items, [], catalog, ['content.pages.read'])).toEqual(['content.pages.read'])
    expect(removableMenuPermissions(items[0]!, items, [], catalog.map(item => ({ ...item, grantable: false })), ['content.pages.read'])).toEqual([])
    expect(removableMenuPermissions(items[0]!, items, [], catalog.map(item => ({ ...item, available: false })), ['content.pages.read'])).toEqual([])
  })
  it('联合输入拒绝重复菜单、重复权限、不安全版本及额外字段', () => {
    const input = { version: 1, menuIds: ['1'], permissions: ['content.pages.read'] }
    expect(roleAuthorizationSchema.safeParse(input).success).toBe(true)
    for (const extra of [{ version: 0 }, { menuIds: ['1', '1'] }, { permissions: ['content.pages.read', 'content.pages.read'] }, { isRoot: true }]) expect(roleAuthorizationSchema.safeParse({ ...input, ...extra }).success).toBe(false)
  })
})
