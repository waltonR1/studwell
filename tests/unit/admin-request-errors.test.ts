import { describe, expect, it } from 'vitest'
import { adminRequestMessage, adminOperationMessage, createAdminSessionChangedError, getAdminRequestFailure, isCsrfFailure, isPasswordChangeFailure, isSessionExpiryFailure } from '../../app/utils/admin/request/errors'
import { safeAdminRedirect } from '../../app/utils/admin/auth/redirect'

function failure(code: string, requestId = 'req-1') {
  return {
    data: {
      success: false,
      error: { code, message: 'server message', fields: [{ path: 'field', message: '字段错误' }] },
      requestId,
    },
  }
}

describe('后台请求错误与恢复合同', () => {
  it('全局恢复已接管时不重复局部通知，普通错误和无横幅时仍有反馈', () => {
    for (const code of ['CSRF_REJECTED', 'UNAUTHENTICATED', 'PASSWORD_CHANGE_REQUIRED']) {
      expect(adminOperationMessage(failure(code), true)).toBe('')
      expect(adminOperationMessage(failure(code), false)).not.toBe('')
    }
    expect(adminOperationMessage(failure('CONFLICT'), true)).not.toBe('')
    expect(adminOperationMessage(failure('FORBIDDEN'), true)).not.toBe('')
    expect(adminOperationMessage(createAdminSessionChangedError())).toBe('')
  })
  it('按错误代码区分 Session、改密与 CSRF，不把普通 403 当作失效', () => {
    expect(isSessionExpiryFailure(getAdminRequestFailure(failure('UNAUTHENTICATED')))).toBe(true)
    expect(isPasswordChangeFailure(getAdminRequestFailure(failure('PASSWORD_CHANGE_REQUIRED')))).toBe(true)
    expect(isCsrfFailure(getAdminRequestFailure(failure('CSRF_REJECTED')))).toBe(true)
    expect(isSessionExpiryFailure(getAdminRequestFailure(failure('FORBIDDEN')))).toBe(false)
    expect(adminRequestMessage(failure('FORBIDDEN'))).toContain('无权执行此操作')
  })

  it('错误反馈精简但结构化信息保留 Request ID，并区分 429、500 与网络失败', () => {
    expect(adminRequestMessage(failure('RATE_LIMITED'))).toContain('请求过于频繁')
    expect(adminRequestMessage(failure('INTERNAL_ERROR'))).toContain('请求编号：req-1')
    expect(getAdminRequestFailure(failure('INTERNAL_ERROR'))).toMatchObject({ requestId: 'req-1', fields: ['字段错误'] })
    expect(adminRequestMessage({ status: 500 })).toContain('服务暂时不可用')
    expect(adminRequestMessage(new Error('socket closed'))).toContain('连接失败')
  })

  it('409 保留 HTTP 冲突语义并提供明确恢复原因', () => {
    const conflict = (reason: string) => ({
      data: {
        success: false,
        error: { code: 'CONFLICT', reason, message: 'server conflict', fields: [{ path: 'version', message: '业务提示' }] },
        requestId: 'req-conflict',
      },
    })
    expect(adminRequestMessage(conflict('STALE'))).toContain('刷新后重试')
    expect(adminRequestMessage(conflict('DUPLICATE'))).toContain('该信息已被占用')
    expect(adminRequestMessage(conflict('REFERENCED'))).toContain('仍被引用')
    expect(adminRequestMessage(conflict('PAGE_CONFIGURED'))).toContain('请改为隐藏入口')
    expect(adminRequestMessage(conflict('RETRY'))).toContain('稍后重试')
    expect(getAdminRequestFailure(conflict('STALE'))).toMatchObject({ code: 'CONFLICT', reason: 'STALE' })
  })

  it('恢复目标只接受站内后台路径', () => {
    expect(safeAdminRedirect('/admin/users?page=2&pageSize=10')).toBe('/admin/users?page=2&pageSize=10')
    for (const value of ['https://example.com', '//example.com/admin', '/admin/login', '/admin/change-password', '/admin/%2F%2Fevil', '/admin\\evil', null]) {
      expect(safeAdminRedirect(value)).toBe('/admin')
    }
  })
})
