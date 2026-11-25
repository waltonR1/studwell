import { describe, expect, it } from 'vitest'
import { describeMenu } from '../../app/utils/admin/menus/tree'

describe('BF-06 授权展示与菜单层级', () => {
  it('父级隐藏与页面自身隐藏分别表达；路径供检索使用，不改动原树', () => {
    const root = { id: '1', parentId: null, name: '账号与权限', visible: false }
    const page = { id: '2', parentId: '1', name: '角色管理', visible: true }
    expect(describeMenu(page, [root, page])).toEqual({ depth: 1, path: '账号与权限 / 角色管理', hiddenByParent: true })
    expect(page.visible).toBe(true)
    expect(describeMenu(root, [root, page]).hiddenByParent).toBe(false)
    expect(describeMenu({ ...page, parentId: '999' }, [root, page]).depth).toBe(0)
  })
  it('遗留循环引用不会导致展示工具无限遍历', () => {
    const a = { id: '1', parentId: '2', name: 'A', visible: true }, b = { id: '2', parentId: '1', name: 'B', visible: true }
    expect(describeMenu(a, [a, b]).depth).toBe(1)
  })
})
