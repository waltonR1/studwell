import {menuPagePath} from '../../server/policies/menu-path'
// 菜单输入边界：非法 ID 必须转为字段错误，不能触发 BigInt 异常。
import { describe, expect, it } from 'vitest'
import { menuCreateSchema, menuUpdateSchema, menuMoveSchema } from '../../shared/schemas/admin/menus'
import { menuPageCatalog } from '../../server/config/menus'
import { menuPageOptions } from '../../app/utils/admin/menus/page-options'
const base = { iconKey: 'folder', code: 'directory', pageKey: null, name: 'Directory', parentId: null, sortOrder: 10, visible: true }
describe('菜单合同', () => {
  it('图标缺失和失效时返回中文操作提示，不展示内部枚举', () => {
    const {code: _code, pageKey: _pageKey, ...fields} = base
    for (const [iconKey, message] of [[undefined, '请选择菜单图标'], ['', '请选择菜单图标'], [null, '请选择菜单图标'], ['unknown-icon', '所选图标不可用，请重新选择']] as const) {
      for (const result of [menuCreateSchema.safeParse({...base, iconKey}), menuUpdateSchema.safeParse({...fields, version: 1, iconKey})]) {
        expect(result.success).toBe(false)
        if (!result.success) expect(result.error.issues).toEqual([expect.objectContaining({path: ['iconKey'], message})])
      }
    }
    expect(menuCreateSchema.safeParse(base).success).toBe(true)
  })
  it('移动要求合法相邻菜单、双方版本及明确方向', () => {
    const input = { version: 1, neighborId: '2', neighborVersion: 1, direction: 'up' }
    expect(menuMoveSchema.safeParse(input).success).toBe(true)
    for (const patch of [{ direction: 'left' }, { neighborId: '0' }, { neighborVersion: 0 }, { version: 0 }, { sortOrder: 100 }]) expect(menuMoveSchema.safeParse({ ...input, ...patch }).success).toBe(false)
  })
  it('通配维护页重复绑定仍可选，固定已绑/无权/停用项不显示在新增候选', () => {
    const pages = menuPageCatalog.map(page => ({ ...page, grantable: true }))
    const options = menuPageOptions([...pages, { key: 'unavailable', name: '停用', path: '/admin/x', permission: 'x.read', available: false, grantable: true }], [{ pageKey: 'roles' }, { pageKey: 'website_page' }])
    expect(options.some(item => item.value === 'roles')).toBe(false)
    expect(options.some(item => item.value === 'website_page')).toBe(true)
    expect(options.some(item => item.value === 'unavailable')).toBe(false)
    expect(menuPageOptions(pages.map(page => ({ ...page, grantable: false })), [])).toEqual([{ label: '目录', value: '' }])
    expect(menuPageOptions(pages, [{ pageKey: 'roles' }], 'roles').some(item => item.value === 'roles')).toBe(true)
    expect(menuPageOptions([], [], 'legacy_page')[1]).toMatchObject({ value: 'legacy_page' })
    expect(menuPagePath(pages.find(page => page.key === 'website_page'), 'company_intro')).toBe('/admin/website/company_intro')
    expect(menuPagePath(pages.find(page => page.key === 'website_page'), 'quality_assurance')).toBe('/admin/website/quality_assurance')
    expect(menuPagePath(pages.find(page => page.key === 'roles'), 'another_code')).toBe('/admin/roles')
  })
  it('拒绝恶意父级、大整数溢出和额外路径字段', () => {
    for (const parentId of ['abc', '0', '-1', '1e2', '', '18446744073709551616']) expect(menuCreateSchema.safeParse({ ...base, parentId }).success).toBe(false)
    expect(menuCreateSchema.safeParse({ ...base, parentId: '18446744073709551615' }).success).toBe(true)
    expect(menuCreateSchema.safeParse({ ...base, path: 'https://external.test' }).success).toBe(false)
    expect(menuUpdateSchema.safeParse({ ...base, version: 1 }).success).toBe(false)
  })
  it('拒绝越界排序和空名称', () => {
    expect(menuCreateSchema.safeParse({ ...base, sortOrder: -1 }).success).toBe(false)
    expect(menuCreateSchema.safeParse({ ...base, sortOrder: 10000 }).success).toBe(false)
    expect(menuCreateSchema.safeParse({ ...base, name: '  ' }).success).toBe(false)
  })
})
