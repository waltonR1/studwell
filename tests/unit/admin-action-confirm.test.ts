import { effectScope } from 'vue'
import { describe, expect, it } from 'vitest'
import { useAdminActionConfirm } from '../../app/composables/admin/interaction/useAdminActionConfirm'

describe('后台页面作用域确认', () => {
  it('明确展示标题与后果，确认/取消分别结算，不重放动作', async () => {
    const scope = effectScope(), dialog = scope.run(() => useAdminActionConfirm())!
    const pending = dialog.ask({ title: '删除账号', message: '删除目标账号及后果', confirmLabel: '删除账号' })
    expect(dialog.state.value?.title).toBe('删除账号')
    dialog.settle(false)
    expect(await pending).toBe(false)
    const next = dialog.ask({ title: '重置账号密码', message: '撤销会话', confirmLabel: '确认重置' })
    dialog.settle(true)
    expect(await next).toBe(true)
    expect(dialog.state.value).toBeNull()
    dialog.settle(true)
    scope.stop()
  })
  it('重复请求和页面离开安全取消待处理确认', async () => {
    const scope = effectScope(), dialog = scope.run(() => useAdminActionConfirm())!
    const options = { title: '删除账号', message: '原有确认内容', confirmLabel: '删除账号' }
    const first = dialog.ask(options), second = dialog.ask(options)
    expect(await first).toBe(false)
    scope.stop()
    expect(await second).toBe(false)
    expect(dialog.state.value).toBeNull()
  })
})
