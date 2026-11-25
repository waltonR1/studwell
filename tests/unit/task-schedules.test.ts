import { describe, expect, it } from 'vitest'
import { nextTaskTimes } from '../../server/policies/task-schedule'
import { taskRunSchema, taskControlSchema } from '../../shared/schemas/admin/tasks'
const now = new Date('2026-10-26T00:00:00Z')
describe('固定任务执行计划', () => {
  it('北京时间每天与间隔的未来五次', () => {
    expect(nextTaskTimes('log_cleanup', { mode: 'daily', time: '03:00' }, now)[0]?.toISOString()).toBe('2026-10-26T19:00:00.000Z')
    expect(nextTaskTimes('auth_cleanup', { mode: 'interval', minutes: 15 }, now).map(d => d.getTime() - now.getTime())).toEqual([1,2,3,4,5].map(n => n*900000))
  })
  it('拒绝秒字段、Quartz、无后续日期、过密及跨午夜过密', () => {
    for (const expression of ['0 0 3 * * *', '0 3 ? * *', '* * * * *', '0 3 31 2 *', '0,59 0,23 * * *']) expect(() => nextTaskTimes('log_cleanup', { mode: 'cron', expression }, now)).toThrow()
    expect(() => nextTaskTimes('log_cleanup', { mode: 'interval', minutes: 15 }, now)).toThrow()
  })
  it('日与周同时指定时按OR匹配，闰年有效', () => {
    expect(nextTaskTimes('log_cleanup', { mode: 'cron', expression: '0 3 1 * 2' }, now)[0]?.toISOString()).toBe('2026-10-26T19:00:00.000Z')
    expect(nextTaskTimes('log_cleanup', { mode: 'cron', expression: '0 3 29 2 *' }, now, 1)[0]?.toISOString()).toBe('2028-02-28T19:00:00.000Z')
  })
  it('危险动作须明确确认，禁止非内置控制指令', () => {
    expect(taskRunSchema.safeParse({ version: 1, confirmed: false }).success).toBe(false)
    expect(taskControlSchema.safeParse({ action: 'kill-web', confirmed: true }).success).toBe(false)
  })
})
