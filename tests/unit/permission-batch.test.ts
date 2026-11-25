import { describe, expect, it } from 'vitest'
import { permissionBatchState, togglePermissionBatch } from '../../app/utils/admin/roles/permission-groups'
const items = [
  { code: 'system.users.read', name: '查看账号', available: true, grantable: true },
  { code: 'system.users.update', name: '编辑账号', available: true, grantable: true },
  { code: 'system.users.delete', name: '删除账号', available: true, grantable: false },
  { code: 'system.users.write', name: '旧权限', available: false, grantable: true },
]
describe('权限分组批量草稿', () => {
  it('三态只计算有效可授予集合，空集合不算全选', () => {
    expect(permissionBatchState(items, [])).toMatchObject({ checked: false, indeterminate: false, count: 0 })
    expect(permissionBatchState(items, [items[0]!.code])).toMatchObject({ checked: false, indeterminate: true })
    expect(permissionBatchState(items, [items[0]!.code, items[1]!.code])).toMatchObject({ checked: true, indeterminate: false })
    expect(permissionBatchState(items.slice(2), items.map(item => item.code))).toMatchObject({ checked: false, indeterminate: false, eligible: [] })
  })
  it('全选/取消仅修改本地有效项，越界、停用及其他分组原值保留', () => {
    const original = [items[2]!.code, items[3]!.code, 'system.roles.read']
    const result = togglePermissionBatch(items, original, true)
    expect(result).toEqual([...original, items[0]!.code, items[1]!.code])
    expect(original).toEqual([items[2]!.code, items[3]!.code, 'system.roles.read'])
    expect(togglePermissionBatch(items, result, false)).toEqual(original)
    expect(togglePermissionBatch(items, result, true)).toEqual(result)
    expect(togglePermissionBatch(items, [], true)).not.toContain(items[2]!.code)
    expect(togglePermissionBatch(items, [], true)).not.toContain(items[3]!.code)
  })
  it('仅看已选只限定当前可见项，不影响筛选外授权', () => {
    const selected = [items[0]!.code, items[1]!.code, items[3]!.code]
    const visible = items.filter(item => selected.includes(item.code) && item.available)
    expect(togglePermissionBatch(visible, selected, false)).toEqual([items[3]!.code])
    expect(selected).toHaveLength(3)
  })
})
