import {afterEach, describe, expect, it, vi} from 'vitest'
import {taskSeedDefaults} from '../../scripts/database/seed/system'
import {resolveParameterRows, resolveListPageSize, readParameterValues, resolveLogRetention} from '../../server/services/parameter-values'
import {parameterRepository} from '../../server/repositories/parameters'
import {taskRepository} from '../../server/repositories/tasks'
import {DEFAULT_ADMIN_PAGE_SIZE} from '../../shared/config/admin/pagination'
import {paginationSchema} from '../../shared/schemas/admin/pagination'
import {taskRetentionSchema, taskScheduleSchema} from '../../shared/schemas/admin/tasks'
import type {DatabaseExecutor} from '../../server/db/transaction'

afterEach(() => vi.restoreAllMocks())

describe('业务默认值与生效优先级', () => {
    const row = {id: 1n, key: 'admin.list.defaultPageSize', value: '50', defaultValue: '10', version: 1,
        createdAt: new Date(), updatedAt: new Date(), createdBy: null, updatedBy: null}
    it('有效覆盖优先；NULL 和非法覆盖读取数据库默认值', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        expect(resolveParameterRows([row]).values[row.key]).toBe(50)
        expect(resolveParameterRows([{...row, value: null}]).values[row.key]).toBe(10)
        expect(resolveParameterRows([]).values[row.key]).toBeUndefined()
        const invalid = resolveParameterRows([{...row, value: '"50"'}])
        expect(invalid.values[row.key]).toBe(10)
        expect(invalid.invalid.has(row.key)).toBe(true)
    })
    it('分页请求的基础解析与数据库生效参数相互独立', async () => {
        expect(paginationSchema.parse({}).pageSize).toBe(DEFAULT_ADMIN_PAGE_SIZE)
        vi.spyOn(parameterRepository, 'all').mockResolvedValueOnce([])
        await expect(resolveListPageSize({} as DatabaseExecutor)).rejects.toMatchObject({diagnosticCode: 'PARAMETER_SEED_REQUIRED'})
    })
    it('数据库读取失败不会伪装成使用默认策略的成功响应', async () => {
        const failure = new Error('fixture database unavailable')
        vi.spyOn(parameterRepository, 'all').mockRejectedValueOnce(failure)
        await expect(readParameterValues({} as DatabaseExecutor)).rejects.toBe(failure)
    })
    it('任务配置缺失时不会静默使用初始化保留天数', async () => {
        vi.spyOn(taskRepository, 'byCode').mockResolvedValueOnce(undefined)
        await expect(resolveLogRetention({} as DatabaseExecutor)).rejects.toThrow('TASK_CONFIGURATION_MISSING')
    })
    it('任务初始化默认值符合计划、保留期和最低频率约束', async () => {
        const {nextTaskTimes} = await import('../../server/policies/task-schedule')
        const now = new Date('2026-10-29T00:00:00Z')
        for (const [code, definition] of Object.entries(taskSeedDefaults)) {
            expect(taskScheduleSchema.safeParse(definition.schedule).success).toBe(true)
            expect(nextTaskTimes(code as keyof typeof taskSeedDefaults, definition.schedule, now, 1)[0]!.getTime()).toBeGreaterThan(now.getTime())
            expect(typeof definition.enabled).toBe('boolean')
        }
        expect(taskRetentionSchema.safeParse(taskSeedDefaults.log_cleanup.retention).success).toBe(true)
        expect(taskSeedDefaults.auth_cleanup.retention).toBeNull()
        expect(taskSeedDefaults.run_cleanup.retention).toBeNull()
    })
})
