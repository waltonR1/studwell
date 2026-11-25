// 账号输入边界：拒绝 Root/权限注入、不可变用户名更新和非法关联 ID。
import { describe, expect, it } from 'vitest'
import { userCreateSchema, userUpdateSchema, userRolesSchema, userResetSchema } from '../../shared/schemas/admin/users'
const profile = { displayName: 'Tester', email: null, enabled: true, version: 1 }
describe('账号管理合同', () => {
  it('预留资料允许省略/null/空白，部门岗位兼容历史自由文本', () => {
    expect(userUpdateSchema.parse({ version: 1, phone: '  ', department: null, position: '  operations  ', remark: '  内部账号  ' })).toMatchObject({ phone: null, department: null, position: 'operations', remark: '内部账号' })
    for (const [key, length] of [['phone', 32], ['department', 80], ['position', 80], ['remark', 500]] as const) {
      expect(userUpdateSchema.safeParse({ version: 1, [key]: 'a'.repeat(length) }).success).toBe(true)
      expect(userUpdateSchema.safeParse({ version: 1, [key]: 'a'.repeat(length + 1) }).success).toBe(false)
    }
    expect(userUpdateSchema.parse({ version: 1, department: '研发部', position: '编辑' })).toMatchObject({ department: '研发部', position: '编辑' })
    expect(userUpdateSchema.safeParse({ version: 1 }).success).toBe(false)
    expect(userUpdateSchema.safeParse({ version: 1, enabled: false }).success).toBe(true)
    expect(userUpdateSchema.safeParse({ version: 1, remark: '备注', isRoot: true }).success).toBe(false)
  })
  it('创建规范化用户名，不接受权限字段或已删除标记', () => {
    expect(userCreateSchema.parse({ username: ' Member_A ', displayName: 'Tester', email: null, password: '123456' }).username).toBe('member_a')
    for (const field of ['isRoot', 'roleIds', 'deletedAt']) expect(userCreateSchema.safeParse({ username: 'test_a', displayName: 'Tester', email: null, password: '123456', [field]: true }).success).toBe(false)
    expect(userUpdateSchema.safeParse({ ...profile, username: 'changed' }).success).toBe(false)
  })
  it('长度按 Unicode 计算，ID 拒绝指数、溢出和重复，资料校验邮箱', () => {
    expect(userResetSchema.safeParse({ version: 1, password: '🙂'.repeat(6) }).success).toBe(true)
    expect(userResetSchema.safeParse({ version: 1, password: 'a'.repeat(129) }).success).toBe(false)
    for (const roleIds of [['abc'], ['0'], ['1e2'], ['18446744073709551616'], ['1', '1']]) expect(userRolesSchema.safeParse({ version: 1, roleIds }).success).toBe(false)
    expect(userUpdateSchema.safeParse({ ...profile, email: 'invalid' }).success).toBe(false)
  })
})
