// 根据任务计划计算下次执行时间，不创建定时器。
import {taskDefinitions} from '../config/tasks'
import {Cron, CronPattern} from 'croner'
import {taskScheduleSchema} from '#shared/schemas/admin/tasks'
import type {TaskCode, TaskSchedule} from '#shared/types/admin/tasks.ts'
import {ApiError} from '../core/errors'

function cron(schedule: Exclude<TaskSchedule, { mode: 'interval' }>) {
    return new Cron(schedule.mode === 'daily' ? `${Number(schedule.time.slice(3))} ${Number(schedule.time.slice(0, 2))} * * *` : schedule.expression, {
        timezone: 'Asia/Shanghai',
        paused: true,
        mode: '5-part',
        domAndDow: false
    })
}

export function nextTaskTimes(code: TaskCode, input: unknown, now = new Date(), count = 5): Date[] {
    const parsed = taskScheduleSchema.safeParse(input)
    if (!parsed.success) throw new ApiError('INVALID_INPUT', [{path: 'schedule', message: '执行规则格式不正确。'}])
    const schedule = parsed.data, minimum = taskDefinitions[code].minimumMinutes
    try {
        if (schedule.mode === 'interval') {
            if (schedule.minutes < minimum) throw new Error()
            return Array.from({length: count}, (_, i) => new Date(now.getTime() + (i + 1) * schedule.minutes * 60_000))
        }
        const job = cron(schedule)
        try {
            // 检查每日时分组合的最短间距（含跨午夜），保守拒绝过密表达式。
            const expression = schedule.mode === 'daily' ? `${Number(schedule.time.slice(3))} ${Number(schedule.time.slice(0, 2))} * * *` : schedule.expression
            const pattern = new CronPattern(expression, 'Asia/Shanghai', {mode: '5-part'})
            const minutes = pattern.minute.flatMap((active, m) => active ? pattern.hour.flatMap((enabled, h) => enabled ? [h * 60 + m] : []) : []).sort((a, b) => a - b)
            for (let i = 0; i < minutes.length; i++) {
                if ((minutes[(i + 1) % minutes.length]! + (i === minutes.length - 1 ? 1440 : 0) - minutes[i]!) < minimum) throw new Error()
            }
            const next = job.nextRuns(count, now)
            if (next.length !== count) throw new Error()
            return next
        } finally {
            job.stop()
        }
    } catch {
        throw new ApiError('INVALID_INPUT', [{
            path: 'schedule',
            message: `执行规则无有效后续时间或过于频繁；本任务间隔至少${minimum}分钟（Cron按每日时分组合校验）。`
        }])
    }
}
