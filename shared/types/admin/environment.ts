// 系统环境只读快照；系统资源与当前网站进程分别计量。
export interface EnvironmentData {
    sampledAt: string
    instanceId: string
    scope: 'os-visible'
    system: { type: string; release: string; arch: string; uptimeSeconds: number }
    cpu: {
        model: string | null
        logicalCores: number | null
        availableParallelism: number
        usagePercent: number | null
        sampleWindowMs: number | null
        status: 'ready' | 'sampling' | 'unavailable'
    }
    memory: { totalBytes: number; freeBytes: number; occupiedBytes: number; occupiedPercent: number | null }
    application: {
        nodeVersion: string
        uptimeSeconds: number
        rssBytes: number
        heapUsedBytes: number
        heapAllocatedBytes: number
        heapLimitBytes: number
        constrainedMemoryBytes: number | null
    }
}
