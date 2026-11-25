import { describe, expect, it } from 'vitest'
import { dictionaryCreateSchema, dictionaryUpdateSchema, dictionaryItemCreateSchema, dictionaryItemUpdateSchema, dictionaryOptionsQuerySchema } from '../../shared/schemas/admin/dictionaries'
describe('字典输入合同', () => {
  it('严格编码、名称/说明边界及不可变字段', () => {
    const fields = { name: ' 名称 ', description: '', enabled: true }
    expect(dictionaryCreateSchema.parse({ ...fields, code: 'test_kind' }).name).toBe('名称')
    for (const code of ['Abc', 'a', 'has.dot', ' space ', '<script>']) expect(dictionaryCreateSchema.safeParse({ ...fields, code }).success).toBe(false)
    for (const extra of [{ code: 'changed' }, { id: '1' }, { createdBy: '1' }, { deletedAt: null }]) expect(dictionaryUpdateSchema.safeParse({ ...fields, version: 1, ...extra }).success).toBe(false)
    expect(dictionaryCreateSchema.safeParse({ ...fields, code: 'test_kind', description: 'x'.repeat(301) }).success).toBe(false)
  })
  it('选项类型、版本、跨类型ID及版本查询严格校验', () => {
    const item = { code: 'test_option', name: '选项', sortOrder: 0, enabled: true, version: 1 }
    expect(dictionaryItemCreateSchema.safeParse(item).success).toBe(true)
    for (const sortOrder of [-1, 1.5, 1000000, '20']) expect(dictionaryItemCreateSchema.safeParse({ ...item, sortOrder }).success).toBe(false)
    for (const dictionaryId of ['abc', '01', '0', '1e2', '18446744073709551616']) expect(dictionaryItemUpdateSchema.safeParse({ name: 'x', sortOrder: 0, enabled: true, version: 1, dictionaryId }).success).toBe(false)
    for (const version of [0, -1, 4294967295]) expect(dictionaryItemCreateSchema.safeParse({ ...item, version }).success).toBe(false)
    expect(dictionaryOptionsQuerySchema.safeParse({ version: 'a'.repeat(64) }).success).toBe(true)
    expect(dictionaryOptionsQuerySchema.safeParse({ version: ['a'.repeat(64)] }).success).toBe(false)
    expect(dictionaryOptionsQuerySchema.safeParse({ includeDisabled: 'true' }).success).toBe(false)
  })
})
