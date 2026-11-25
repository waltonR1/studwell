// 固定任务目录及不可突破的执行频率边界。
// 正常运行必须读取数据库任务配置；缺失或非法配置不会退回默认计划执行。
import type {TaskCode} from '#shared/types/admin/tasks'

export const taskDefinitions: Record<TaskCode, {
    name: string;
    description: string;
    minimumMinutes: number;
}> = {
    log_cleanup: {
        name: '日志清理',
        description: '按三类保留天数分批清理日志，未知认证事件保留。',
        minimumMinutes: 60,
    },
    auth_cleanup: {
        name: '会话与限流残留清理',
        description: '回收绝对到期会话及超过最长允许窗口的旧限流键。',
        minimumMinutes: 5,
    },
    run_cleanup: {
        name: '执行记录清理',
        description: '分批回收90天前已结束的执行记录，不删除操作审计。',
        minimumMinutes: 60,
    },
    search_rebuild: {
        name: '站内搜索索引重建',
        description: '内容发布、恢复或下线后自动更新已启用语言索引；失败时保留上一版并重试。',
        minimumMinutes: 5,
    },
}

// 已结束状态供调度收尾和执行记录回收共用。
export const terminalRunStatuses = ['success', 'failed', 'stopped', 'terminated', 'interrupted'] as const

export const taskReasons: Record<string, string> = {
    STOPPED: '管理员请求停止', FORCE_STOPPED: '管理员强制终止', WORKER_EXIT: '执行进程退出，结果已核查',
    WORKER_START: '执行进程启动失败', LEASE_LOST: '执行权已失效', OWNER_LOST: '执行实例失联',
    EXECUTION_FAILED: '执行失败，请通过执行编号排查', CONTROL_STALE: '执行已结束，控制请求未执行',
}
