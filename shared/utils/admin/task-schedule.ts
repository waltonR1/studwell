// 后台任务调度配置的显示说明，供服务端响应与页面快照展示共用。
import type {TaskSchedule} from '../../types/admin/tasks'

export function taskScheduleText(schedule: TaskSchedule) {
    return schedule.mode === 'daily' ? `每天 ${schedule.time}（北京时间）` : schedule.mode === 'interval' ? `每次完成后 ${schedule.minutes} 分钟` : `Cron ${schedule.expression}（北京时间；日/周同时限定时按或匹配）`
}
