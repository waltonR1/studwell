import {rateCleanupCutoff} from '../../server/policies/cleanup'
import {MAX_RATE_WINDOW_SECONDS} from '../../server/config/parameters'
import { parameterRelations } from '../../shared/utils/admin/parameter-relations'
import { describe, expect, it, vi } from 'vitest'
import {parameterSeedDefaults as defaults} from '../../scripts/database/seed/system'
import { parameterDefinitions } from '../../server/config/parameters'
import { resolveParameterRows } from '../../server/services/parameter-values'
import { parameterBatchSchema } from '../../shared/schemas/admin/parameters'
import { generateInitialPassword } from '../../app/utils/admin/auth/password'
describe('参数登记与策略兜底', () => {
  it('限流回收使用配置允许的最大窗口，不随当前默认窗口缩短', () => {
    expect(MAX_RATE_WINDOW_SECONDS).toBe(86400)
    for (const definition of parameterDefinitions.filter(row => row.key.endsWith('.windowSeconds'))) expect(definition.max).toBe(MAX_RATE_WINDOW_SECONDS)
    expect(rateCleanupCutoff(new Date('2026-10-26T04:00:00Z'))).toEqual(new Date('2026-10-25T04:00:00Z'))
  })
  it('参数登记唯一，默认值全部通过自身校验及关联约束', () => {
    expect(new Set(parameterDefinitions.map(item => item.key)).size).toBe(parameterDefinitions.length)
    expect(defaults).toMatchObject({'security.rate.public-inquiry.count': 8, 'security.rate.public-inquiry.windowSeconds': 600})
    for (const item of parameterDefinitions) { expect(item.schema.safeParse(defaults[item.key]).success).toBe(true); expect(item.effect).toBeTruthy(); expect(item.consumers).toBeTruthy() }
    expect(parameterRelations(defaults)).toBeNull()
    expect(parameterRelations({ ...defaults, 'security.password.minLength': 128, 'security.password.maxLength': 6 })).not.toBeNull()
    expect(parameterRelations({ ...defaults, 'security.session.idleSeconds': 86400 })).not.toBeNull()
  })
  it('单组预检只检查当前组，并允许关联边界相等', () => {
    const invalidPassword = { ...defaults, 'security.password.minLength': 128, 'security.password.maxLength': 6 }
    expect(parameterRelations(invalidPassword, 'session')).toBeNull()
    expect(parameterRelations(invalidPassword, 'password')).not.toBeNull()
    const invalidSession = { ...defaults, 'security.session.idleSeconds': 86400 }
    expect(parameterRelations(invalidSession, 'password')).toBeNull()
    expect(parameterRelations(invalidSession, 'session')).not.toBeNull()
    expect(parameterRelations({ ...defaults, 'security.password.minLength': 128, 'security.password.maxLength': 128, 'security.session.idleSeconds': defaults['security.session.absoluteSeconds']! })).toBeNull()
  })
  it('缺失记录不补值，关联错误整组使用数据库默认值', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(resolveParameterRows([]).values).toEqual({})
      const rows = parameterDefinitions.map((item, index) => ({ id: BigInt(index + 1), key: item.key, defaultValue: JSON.stringify(defaults[item.key]), value: null as string | null, version: 1, createdAt: new Date(), updatedAt: new Date(), createdBy: null, updatedBy: null }))
      rows.find(row => row.key === 'security.password.blocklistEnabled')!.value = '"false"'
      rows.find(row => row.key === 'security.password.minLength')!.value = '128'
      rows.find(row => row.key === 'security.password.maxLength')!.value = '6'
      const result = resolveParameterRows(rows)
      expect(result.values['security.password.blocklistEnabled']).toBe(true)
      expect(result.values['security.password.minLength']).toBe(6); expect(result.values['security.password.maxLength']).toBe(128)
      expect(result.invalid.has('security.password.minLength')).toBe(true)
      expect(JSON.stringify(warn.mock.calls)).not.toContain('"false"')
    } finally { warn.mockRestore() }
  })
  it('批量合同拒绝重复目标、溢出 ID 和定义注入，随机密码长度可适配策略', () => {
    expect(parameterBatchSchema.safeParse({ items: [{ id: '1', version: 1, value: false }] }).success).toBe(true)
    expect(parameterBatchSchema.safeParse({ items: [{ id: '18446744073709551616', version: 1, value: false }] }).success).toBe(false)
    expect(parameterBatchSchema.safeParse({ items: [{ id: '1', version: 1, value: false }, { id: '1', version: 1, value: true }] }).success).toBe(false)
    expect(parameterBatchSchema.safeParse({ items: [{ id: '1', version: 1, value: true, key: 'anything' }] }).success).toBe(false)
    expect(generateInitialPassword(64)).toHaveLength(64)
  })
})
