import {describe, expect, it} from 'vitest'
import {taskScheduleSchema, taskRetentionSchema, taskRunQuerySchema, type TaskRunQueryInput} from '../../shared/schemas/admin/tasks'
import {parameterBatchSchema} from '../../shared/schemas/admin/parameters'
import {TASK_INTERVAL_MINUTES, TASK_RETENTION_DAYS} from '../../shared/config/admin/tasks'

describe('任务与参数跨端输入合同', () => {
    it('执行计划与保留天数使用共享边界，继续拒绝额外字段', () => {
        for (const minutes of [TASK_INTERVAL_MINUTES.min, TASK_INTERVAL_MINUTES.max])
            expect(taskScheduleSchema.safeParse({mode: 'interval', minutes}).success).toBe(true)
        for (const minutes of [4, 10081, 5.5, '5'])
            expect(taskScheduleSchema.safeParse({mode: 'interval', minutes}).success).toBe(false)
        expect(taskScheduleSchema.safeParse({mode: 'daily', time: '24:00'}).success).toBe(false)
        expect(taskScheduleSchema.safeParse({mode: 'daily', time: '03:00', executionAllowed: true}).success).toBe(false)
        expect(taskScheduleSchema.parse({mode: 'cron', expression: ' 0 3 * * * '})).toEqual({mode: 'cron', expression: '0 3 * * *'})
        const days = {login: TASK_RETENTION_DAYS.min, audit: TASK_RETENTION_DAYS.max, security: 730}
        expect(taskRetentionSchema.safeParse(days).success).toBe(true)
        expect(taskRetentionSchema.safeParse({...days, login: 0}).success).toBe(false)
        expect(taskRetentionSchema.safeParse({...days, audit: 3651}).success).toBe(false)
    })
    it('任务历史区分 URL 原始字符串与解析后的分页数值', () => {
        const input: TaskRunQueryInput = {page: '2', pageSize: '50', status: 'running', trigger: 'manual', startDate: '2026-10-01', endDate: '2026-10-28'}
        expect(taskRunQuerySchema.parse(input)).toEqual({...input, page: 2, pageSize: 50})
        expect(taskRunQuerySchema.parse({})).toEqual({page: 1, pageSize: 20})
        for (const invalid of [{page: 2}, {page: ['2']}, {page: '01'}, {pageSize: '30'}, {page: String(Number.MAX_SAFE_INTEGER)}, {status: 'unknown'}, {trigger: 'external'}])
            expect(taskRunQuerySchema.safeParse(invalid).success).toBe(false)
    })
    it('历史日期必须成对、有效且有序，不在 shared 转换数据库时间边界', () => {
        for (const invalid of [{startDate: '2026-10-01'}, {endDate: '2026-10-28'},
            {startDate: '2026-10-29', endDate: '2026-10-28'}, {startDate: '2026-02-30', endDate: '2026-03-01'}])
            expect(taskRunQuerySchema.safeParse(invalid).success).toBe(false)
        const query = taskRunQuerySchema.parse({startDate: '2026-10-01', endDate: '2026-10-28'})
        expect(query.startDate).toBe('2026-10-01')
        expect(query).not.toHaveProperty('start')
    })
    it('批量参数保持 1–50 项边界，拒绝重复 ID 和定义字段注入', () => {
        const items = Array.from({length: 50}, (_, index) => ({id: String(index + 1), version: 1, value: null}))
        expect(parameterBatchSchema.safeParse({items}).success).toBe(true)
        for (const invalid of [{items: []}, {items: [...items, {id: '51', version: 1, value: false}]},
            {items: [items[0], items[0]]}, {items: [{...items[0], editable: true}]},
            {items: [{...items[0], version: 4294967295}]}])
            expect(parameterBatchSchema.safeParse(invalid).success).toBe(false)
    })
})
