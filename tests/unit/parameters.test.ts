import { describe, expect, it } from 'vitest'
import { parameterUpdateSchema, preferenceQuerySchema } from '../../shared/schemas/admin/parameters'
import {ConfigurationError} from '../../server/core/errors'
import {reportDiagnostic} from '../../server/infrastructure/diagnostics'
import {vi} from 'vitest'
describe('参数输入合同', () => {
  it('参数缺失的服务端日志给出初始化提示，客户端错误保持通用合同', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new ConfigurationError('PARAMETER_SEED_REQUIRED')
    reportDiagnostic('api', 'fixture-request', error)
    expect(JSON.parse(log.mock.calls[0]![0])).toMatchObject({reason: 'PARAMETER_SEED_REQUIRED', hint: expect.stringContaining('seed system')})
    expect(error.code).toBe('INTERNAL_ERROR')
    expect(error.status).toBe(500)
  })
  it('接受登记参数的数值范围或恢复默认，不接受类型/范围/定义注入', () => {
    for (const value of [true, false, 10, 20, 50, 99, 100, 5000, 50001, null]) expect(parameterUpdateSchema.safeParse({ version: 1, value }).success).toBe(true)
    for (const value of ['20', 0, 86400001, {}, undefined]) expect(parameterUpdateSchema.safeParse({ version: 1, value }).success).toBe(false)
    for (const extra of [{ key: 'password' }, { editable: true }, { defaultValue: 10 }]) expect(parameterUpdateSchema.safeParse({ version: 1, value: 20, ...extra }).success).toBe(false)
    expect(preferenceQuerySchema.safeParse({ version: ['x'] }).success).toBe(false)
    expect(preferenceQuerySchema.safeParse({ other: 'x' }).success).toBe(false)
  })
})
