// 无数据库、权限或 HTTP 依赖；每个网站实例共享短时快照，按请求采样，不启动后台任务。
import * as os from 'node:os'
import {randomUUID} from 'node:crypto'
import {getHeapStatistics} from 'node:v8'
import type {EnvironmentData} from '#shared/types/admin/environment'

export interface EnvironmentSource {
    clock: () => number
    date: () => Date
    cpus: typeof os.cpus
    parallelism: () => number
    totalMemory: () => number
    freeMemory: () => number
    system: () => EnvironmentData['system']
    application: () => EnvironmentData['application']
}

const source: EnvironmentSource = {
    clock: () => performance.now(), date: () => new Date(), cpus: os.cpus,
    parallelism: os.availableParallelism, totalMemory: os.totalmem, freeMemory: os.freemem,
    system: () => ({type: os.type(), release: os.release(), arch: os.arch(), uptimeSeconds: os.uptime()}),
    application: () => {
        const memory = process.memoryUsage(), constrained = process.constrainedMemory()
        return {
            nodeVersion: process.version, uptimeSeconds: process.uptime(), rssBytes: memory.rss,
            heapUsedBytes: memory.heapUsed, heapAllocatedBytes: memory.heapTotal,
            heapLimitBytes: getHeapStatistics().heap_size_limit,
            constrainedMemoryBytes: constrained > 0 ? constrained : null,
        }
    },
}

export function createEnvironmentCollector(input: EnvironmentSource = source, instanceId = randomUUID()) {
    let previous: {at: number; cores: number; idle: number; total: number} | undefined
    let cached: EnvironmentData | undefined, cachedAt = -Infinity
    return {
        snapshot(): EnvironmentData {
            const now = input.clock()
            if (cached && now - cachedAt >= 0 && now - cachedAt < 1000) return cached
            const cpus = input.cpus(), cores = cpus.length
            const totals = cpus.reduce((sum, cpu) => ({
                idle: sum.idle + cpu.times.idle,
                total: sum.total + Object.values(cpu.times).reduce((a, b) => a + b, 0),
            }), {idle: 0, total: 0})
            const window = previous ? now - previous.at : 0
            let usagePercent: number | null = null, sampleWindowMs: number | null = null
            if (previous && previous.cores === cores && window >= 1000 && window <= 30000) {
                const total = totals.total - previous.total, idle = totals.idle - previous.idle
                if (total > 0 && idle >= 0 && idle <= total) {
                    usagePercent = Math.round((1 - idle / total) * 1000) / 10
                    sampleWindowMs = Math.round(window)
                }
            }
            previous = cores ? {at: now, cores, ...totals} : undefined
            const totalBytes = Math.max(0, input.totalMemory()), freeBytes = Math.min(totalBytes, Math.max(0, input.freeMemory()))
            cached = {
                sampledAt: input.date().toISOString(), instanceId, scope: 'os-visible',
                system: input.system(),
                cpu: {
                    model: cpus[0]?.model.slice(0, 160) || null, logicalCores: cores || null,
                    availableParallelism: input.parallelism(), usagePercent, sampleWindowMs,
                    status: !cores ? 'unavailable' : usagePercent === null ? 'sampling' : 'ready',
                },
                memory: {
                    totalBytes, freeBytes, occupiedBytes: totalBytes - freeBytes,
                    occupiedPercent: totalBytes > 0 ? Math.round((1 - freeBytes / totalBytes) * 1000) / 10 : null,
                },
                application: input.application(),
            }
            cachedAt = now
            return cached
        },
    }
}

export const environmentCollector = createEnvironmentCollector()
