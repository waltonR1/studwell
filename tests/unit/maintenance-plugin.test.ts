import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ close: vi.fn(async () => {}), stop: vi.fn(async () => {}), database: vi.fn(), start: vi.fn() }))
vi.mock('#imports', () => ({ useRuntimeConfig: () => ({ databaseUrl: 'test-only' }) }))
vi.mock('../../server/db', () => ({ getDatabase: mocks.database, closeDatabase: mocks.close }))
vi.mock('../../server/tasks/runner', () => ({ startTaskRunner: mocks.start }))
type Plugin = (app: { hooks: { hook: (name: string, handler: () => Promise<void>) => void } }) => void
let plugin: Plugin
beforeAll(async () => { vi.stubGlobal('defineNitroPlugin', (cb: unknown) => cb); plugin = (await import('../../server/plugins/database')).default as unknown as Plugin })
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks() })
afterAll(() => vi.unstubAllGlobals())
describe('独立任务调度插件', () => {
  it('测试环境不连接数据库，不启动调度进程', async () => {
    vi.stubEnv('NODE_ENV', 'test'); const hook = vi.fn(); plugin({ hooks: { hook } })
    expect(mocks.database).not.toHaveBeenCalled(); expect(mocks.start).not.toHaveBeenCalled()
    await hook.mock.calls[0]![1](); expect(mocks.close).toHaveBeenCalledOnce()
  })
  it('生产只登记控制器，关闭先等待任务，再关闭连接池', async () => {
    vi.stubEnv('NODE_ENV', 'production'); mocks.start.mockReturnValue(mocks.stop)
    const hook = vi.fn(); plugin({ hooks: { hook } })
    expect(mocks.database).not.toHaveBeenCalled(); expect(mocks.start).toHaveBeenCalledOnce()
    await hook.mock.calls[0]![1](); expect(mocks.stop).toHaveBeenCalledOnce()
    expect(mocks.close.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.stop.mock.invocationCallOrder[0]!)
  })
})
