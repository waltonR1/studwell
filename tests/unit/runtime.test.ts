import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

const script = readFileSync(new URL('../../scripts/check-runtime.mjs', import.meta.url), 'utf8')

describe('Node 安全运行时启动门槛', () => {
  it.each([
    ['24.22.1', '7.30.1', 0],
    ['24.22.2', '7.30.2', 0],
    ['24.23.0', '8.12.2', 0],
    ['24.21.0', '7.29.1', 1],
    ['24.22.0', '7.30.1', 1],
    ['24.22.1', '7.30.0', 1],
    ['24.22.1', '7.29.99', 1],
    ['24.22.1', '8.12.1', 1],
    ['24.22.1', undefined, 1],
    ['24.22.1', '9.0.0', 1],
    ['24.23.0-nightly', '7.30.1', 1],
    ['24.22.1', '7.30.1-rc.0', 1],
    ['22.23.4', '7.30.1', 1],
    ['25.0.0', '7.30.1', 1],
  ])('Node %s / Undici %s 返回 %s', (node, undici, expected) => {
    const processStub = { versions: { node, undici }, exitCode: 0 }
    const consoleStub = { log: vi.fn(), error: vi.fn() }
    runInNewContext(script, { process: processStub, console: consoleStub })
    expect(processStub.exitCode).toBe(expected)
    expect(expected ? consoleStub.error : consoleStub.log).toHaveBeenCalledOnce()
  })
})
