import {describe, expect, it, vi} from 'vitest'
import type {CpuInfo} from 'node:os'
import {createEnvironmentCollector, type EnvironmentSource} from '../../server/infrastructure/environment-collector'
import {environmentBytes, environmentDuration} from '../../app/utils/admin/environment'
const rbac = vi.hoisted(() => ({snapshot: vi.fn()}))
vi.mock('../../server/services/access/permissions', () => ({getPermissionSnapshot: rbac.snapshot}))
import {createEnvironmentService} from '../../server/services/environment'

function fixture() {
    let now = 0, idle = 100, busy = 100, cores = 2, free = 25
    const input: EnvironmentSource = {
        clock: () => now, date: () => new Date(now),
        cpus: () => Array.from({length: cores}, () => ({model: 'Fixture CPU', speed: 3000, times: {user: busy, nice: 0, sys: 0, irq: 0, idle}} satisfies CpuInfo)),
        parallelism: () => 2, totalMemory: () => 100, freeMemory: () => free,
        system: () => ({type: 'Windows_NT', release: 'fixture', arch: 'x64', uptimeSeconds: 3600}),
        application: () => ({nodeVersion: 'v24', uptimeSeconds: 60, rssBytes: 20, heapUsedBytes: 5, heapAllocatedBytes: 10, heapLimitBytes: 40, constrainedMemoryBytes: null}),
    }
    return {collector: createEnvironmentCollector(input, 'fixture-instance'), advance: (ms: number, cpuIdle = 100, cpuBusy = 0) => {now += ms; idle += cpuIdle; busy += cpuBusy}, cores: (value: number) => {cores = value}, free: (value: number) => {free = value}}
}

describe('系统环境采集与授权', () => {
    it('首次不伪造 CPU 使用率；短时共享快照，随后按差值计算', () => {
        const f = fixture(), first = f.collector.snapshot()
        expect(first.cpu).toMatchObject({status: 'sampling', usagePercent: null, sampleWindowMs: null})
        f.advance(500, 50, 50)
        expect(f.collector.snapshot()).toBe(first)
        f.advance(500, 25, 75)
        expect(f.collector.snapshot().cpu).toMatchObject({status: 'ready', usagePercent: 62.5, sampleWindowMs: 1000})
    })
    it('间隔过长、核心变化、计数回退和零增量都重新采样', () => {
        const f = fixture(); f.collector.snapshot(); f.advance(31000)
        expect(f.collector.snapshot().cpu.usagePercent).toBeNull()
        f.advance(1000); f.cores(1)
        expect(f.collector.snapshot().cpu.usagePercent).toBeNull()
        f.advance(1000, -1000, -1000)
        expect(f.collector.snapshot().cpu.usagePercent).toBeNull()
        f.advance(1000, 0, 0)
        expect(f.collector.snapshot().cpu.usagePercent).toBeNull()
        f.advance(1000, 100, 0)
        expect(f.collector.snapshot().cpu.usagePercent).toBe(0)
    })
    it('不可用 CPU 明确标记，系统与应用指标互不混淆且输出仅限白名单', () => {
        const f = fixture(); f.cores(0)
        const data = f.collector.snapshot()
        expect(data.cpu).toMatchObject({status: 'unavailable', model: null, logicalCores: null})
        expect(data.memory).toEqual({totalBytes: 100, freeBytes: 25, occupiedBytes: 75, occupiedPercent: 75})
        expect(data.application.rssBytes).toBe(20)
        expect(data.system.uptimeSeconds).not.toBe(data.application.uptimeSeconds)
        expect(Object.keys(data)).toEqual(['sampledAt', 'instanceId', 'scope', 'system', 'cpu', 'memory', 'application'])
        f.free(200); f.advance(1000)
        expect(f.collector.snapshot().memory.occupiedPercent).toBe(0)
    })
    it('每次读取都复核独立权限，未授权不触发资源采集', async () => {
        const collector = {snapshot: vi.fn().mockReturnValue(fixture().collector.snapshot())}
        const service = createEnvironmentService({} as Parameters<typeof createEnvironmentService>[0], collector)
        rbac.snapshot.mockResolvedValue({permissions: ['system.dashboard.read']})
        await expect(service.overview(1n)).rejects.toMatchObject({code: 'FORBIDDEN'})
        expect(collector.snapshot).not.toHaveBeenCalled()
        rbac.snapshot.mockResolvedValue({permissions: ['system.environment.read']})
        await expect(service.overview(1n)).resolves.toMatchObject({instanceId: 'fixture-instance'})
        rbac.snapshot.mockResolvedValue({permissions: []})
        await expect(service.overview(1n)).rejects.toMatchObject({code: 'FORBIDDEN'})
        expect(collector.snapshot).toHaveBeenCalledTimes(1)
    })
    it('内存采用二进制单位；时长按天时分展示', () => {
        expect(environmentBytes(1024 ** 3)).toBe('1 GiB')
        expect(environmentBytes(null)).toBe('—')
        expect(environmentDuration(90061)).toBe('1 天 1 小时 1 分钟')
    })
})
