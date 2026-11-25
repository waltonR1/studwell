import { effectScope, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useInitialPassword } from '../../app/composables/admin/forms/useInitialPassword'
import { useAdminToast } from '../../app/composables/admin/interaction/useAdminToast'
import { userPasswordSchema } from '../../shared/schemas/admin/users'

afterEach(() => vi.unstubAllGlobals())

describe('后台公共交互公开接口', () => {
  it('生成密码通过原校验，复制由用户主动调用；清空表单清除提示', async () => {
    const scope = effectScope(), value = ref(''), disabled = ref(false)
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const field = scope.run(() => useInitialPassword(value, next => { value.value = next }, disabled, 'reset'))!
    await field.generate()
    expect(value.value).toMatch(/^[A-Za-z0-9_-]{20}$/)
    expect(userPasswordSchema.safeParse(value.value).success).toBe(true)
    expect(field.notice.value).toContain('重置前复制')
    expect(writeText).not.toHaveBeenCalled()
    await field.copy()
    expect(writeText).toHaveBeenCalledExactlyOnceWith(value.value)
    value.value = ''
    expect(field.notice.value).toBe('')
    disabled.value = true
    await field.generate()
    await field.copy()
    expect(value.value).toBe('')
    expect(writeText).toHaveBeenCalledTimes(1)
    scope.stop()
  })
  it('复制失败不抛出秘密；异步复制结束不能覆盖已经清空的表单提示', async () => {
    const scope = effectScope(), value = ref('Temporary-secret-123')
    const writeText = vi.fn().mockRejectedValueOnce(new Error('denied'))
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const field = scope.run(() => useInitialPassword(value, next => { value.value = next }, false, 'create'))!
    await field.copy()
    expect(field.notice.value).toContain('复制失败')
    expect(field.notice.value).not.toContain(value.value)
    let finish!: () => void
    writeText.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
    const pending = field.copy()
    value.value = ''
    finish()
    await pending
    expect(field.notice.value).toBe('')
    scope.stop()
  })
  it('Toast 实例互不共享；警告可覆盖成功，重复提示仍可重新展示', () => {
    const first = useAdminToast(), second = useAdminToast()
    first.show('保存成功')
    const original = first.notification.value
    first.show('保存成功')
    expect(first.notification.value).not.toBe(original)
    first.show('已保存，但目录刷新失败', 'warning')
    expect(first.notification.value?.tone).toBe('warning')
    expect(second.notification.value).toBeNull()
    first.dismiss()
    expect(first.notification.value).toBeNull()
  })
})
