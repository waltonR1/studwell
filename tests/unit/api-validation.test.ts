// 输入边界测试：不连接数据库，覆盖分页白名单和高精度 ID。
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {entityIdSchema} from '#shared/schemas/entity'
import {parseInput} from '../../server/core/validation'
import {listQuerySchema} from '#shared/schemas/admin/pagination'

describe('API 查询校验', () => {
  it('默认 20 条，模块可扩展固定筛选', async () => {
    const schema = listQuerySchema.safeExtend({ status: z.enum(['enabled', 'disabled']).optional() })
    expect(await parseInput(schema, {})).toEqual({ page: 1, pageSize: 20 })
    expect(await parseInput(schema, { page: '2', pageSize: '50', status: 'enabled' })).toEqual({ page: 2, pageSize: 50, status: 'enabled' })
  })
  it.each([
    { page: '0' }, { page: '-1' }, { page: '1.5' }, { page: '1e2' }, { page: '' },
    { page: ['1', '2'] }, { pageSize: '100' }, { pageSize: 20 },
    { page: '9007199254740991', pageSize: '50' },
    { sort: 'password_hash' }, { status: 'unknown' }, { search: 'a'.repeat(101) },
  ])('拒绝非法查询 %j', async input => {
    await expect(parseInput(listQuerySchema, input)).rejects.toMatchObject({ code: 'INVALID_INPUT', status: 400 })
  })
  it('扩展查询也保留分页溢出校验', async () => {
    const schema = listQuerySchema.safeExtend({ status: z.string().optional() })
    await expect(parseInput(schema, { page: '9007199254740991' })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })
  it('BIGINT UNSIGNED 以原字符串返回', async () => {
    expect(await parseInput(entityIdSchema, '18446744073709551615')).toBe('18446744073709551615')
  })
  it.each(['0', '-1', '1.5', '01', 'abc', '18446744073709551616', '9'.repeat(100)])('拒绝非法 ID %s', async value => {
    await expect(parseInput(entityIdSchema, value)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })
  it('校验错误不含输入值或自定义异常详情', async () => {
    const secret = 'DO_NOT_EXPOSE_PASSWORD'
    try {
      await parseInput(z.strictObject({ password: z.string().min(100) }), { password: secret })
      throw new Error('应当拒绝')
    } catch (error) {
      expect(error).toMatchObject({ code: 'INVALID_INPUT', fields: [{ path: 'password', message: '字段值不符合要求' }] })
      expect(JSON.stringify(error)).not.toContain(secret)
    }
  })
})
