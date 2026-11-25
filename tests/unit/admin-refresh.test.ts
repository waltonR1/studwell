import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { provideAdminRefreshRegistry, useAdminBusy, useAdminRefresh } from '../../app/composables/admin/navigation/useAdminRefresh'

const context = vi.hoisted(() => ({ values: new Map(), disposers: [] as Array<() => void> }))
vi.mock('vue', async importOriginal => ({
  ...await importOriginal<typeof import('vue')>(),
  provide: (key: symbol, value: unknown) => context.values.set(key, value),
  inject: (key: symbol) => context.values.get(key),
  onScopeDispose: (dispose: () => void) => context.disposers.push(dispose),
}))

beforeEach(() => { context.values.clear(); context.disposers = [] })

describe('后台统一刷新协调', () => {
  it('页面提交阻止刷新，刷新锁不被局部 finally 提前解除', () => {
    const registry = provideAdminRefreshRegistry()
    const submitting = ref(false)
    const busy = useAdminBusy(submitting)
    submitting.value = true
    expect(registry.blocked.value).toBe(true)
    submitting.value = false
    expect(registry.blocked.value).toBe(false)
    registry.refreshing.value = true
    submitting.value = true
    submitting.value = false
    expect(busy.value).toBe(true)
    expect(registry.blocked.value).toBe(false)
    registry.refreshing.value = false
    expect(busy.value).toBe(false)
  })

  it('任一目标失败也等待其他目标完成，再传播错误', async () => {
    const registry = provideAdminRefreshRegistry()
    const failure = new Error('目录读取失败')
    let finish!: () => void
    const slow = new Promise<void>(resolve => { finish = resolve })
    registry.register({ refresh: async () => { throw failure } })
    registry.register({ refresh: () => slow })
    let settled = false
    const result = registry.refresh().catch(error => { settled = true; return error })
    await Promise.resolve()
    await Promise.resolve()
    expect(settled).toBe(false)
    finish()
    expect(await result).toBe(failure)
  })

  it('取消草稿确认时停止后续确认，不执行数据请求', async () => {
    const registry = provideAdminRefreshRegistry()
    const refresh = vi.fn(async () => {})
    const next = vi.fn(async () => true)
    useAdminRefresh(refresh, async () => false)
    useAdminRefresh(refresh, next)
    expect(await registry.confirm()).toBe(false)
    expect(next).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('页面销毁时注销刷新目标及提交状态', async () => {
    const registry = provideAdminRefreshRegistry()
    const submitting = ref(false)
    useAdminBusy(submitting)
    const refresh = vi.fn(async () => {})
    useAdminRefresh(refresh)
    submitting.value = true
    for (const dispose of context.disposers) dispose()
    expect(registry.blocked.value).toBe(false)
    await registry.refresh()
    expect(refresh).not.toHaveBeenCalled()
    const other = ref(true)
    const unregister = registry.registerBusy(other)
    expect(registry.blocked.value).toBe(true)
    unregister()
    expect(registry.blocked.value).toBe(false)
  })
})
