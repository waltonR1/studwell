import { describe, expect, it } from 'vitest'
import { entityIdSchema } from '../../shared/schemas/entity'
import { userPasswordSchema } from '../../shared/schemas/admin/users'
import { isPasswordLengthValid } from '../../shared/utils/admin/password'
import { validatePassword } from '../../server/services/accounts/password'
import {apiErrorCodes} from '../../shared/config/api-errors'
import {ApiError} from '../../server/core/errors'
import { adminRequestMessage } from '../../app/utils/admin/request/errors'

describe('共享后台规则的边界与两端契约', () => {
  it('共享 ID 合同保留字符串并拒绝零、前导零及 uint64 溢出', () => {
    expect(entityIdSchema.parse('18446744073709551615')).toBe('18446744073709551615')
    for (const value of ['0', '01', '-1', '1e2', '18446744073709551616', '9'.repeat(100), 1]) {
      expect(entityIdSchema.safeParse(value).success).toBe(false)
    }
  })
  it('密码按 Unicode 码点计数，表单基础契约与服务端判断一致', () => {
    for (const [length, valid] of [[5, false], [6, true], [128, true], [129, false]] as const) {
      const password = '😀'.repeat(length)
      expect(isPasswordLengthValid(password)).toBe(valid)
      expect(userPasswordSchema.safeParse(password).success).toBe(valid)
      if (valid) expect(() => validatePassword(password, false)).not.toThrow()
      else expect(() => validatePassword(password, false)).toThrow()
    }
    expect(isPasswordLengthValid('😀'.repeat(8), { minLength: 8, maxLength: 8 })).toBe(true)
    expect(isPasswordLengthValid('😀'.repeat(7), { minLength: 8, maxLength: 8 })).toBe(false)
  })
  it('已登记错误码都有前端提示，未知错误仍隐藏服务端消息', () => {
    const failure = (code: string) => ({ data: { success: false, error: { code, message: '内部消息' }, requestId: 'req-1' } })
    for (const code of apiErrorCodes) {
      expect(new ApiError(code).status).toBeGreaterThanOrEqual(400)
      expect(adminRequestMessage(failure(code))).not.toBe('操作未完成，请稍后重试。')
    }
    expect(adminRequestMessage(failure('UNKNOWN_ERROR'))).toBe('操作未完成，请稍后重试。')
    expect(adminRequestMessage(failure('TASK_BUSY'))).toContain('排队')
    expect(adminRequestMessage(failure('TASK_SCHEDULER_OFFLINE'))).toContain('未在线')
  })
})
