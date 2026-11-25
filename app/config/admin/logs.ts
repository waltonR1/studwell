// 后台日志页面专用说明与目标展示名称。
import type {LogKind} from '#shared/types/admin/logs'

export const logTargetNames: Record<string, string> = {
    news: '新闻中心',
    site_settings: '全站公共配置',
    media: '媒体资源',
    user: '账号',
    role: '角色',
    menu: '菜单',
    parameter: '系统参数',
    dictionary: '字典类型',
    dictionary_item: '字典选项',
    log_export: '日志导出',
    maintenance: '系统维护',
    scheduled_task: '定时任务'
}

export const logDescriptions: Record<LogKind, string> = {
    login: '查看登录尝试与主动退出记录；登录前的安全拦截请到安全事件中查看。',
    audit: '查看后台资料维护、授权调整、系统维护及日志导出的执行记录。',
    security: '查看密码修改、安全校验拦截、权限拒绝和访问限制记录。'
}

// 日志列表日期范围选项。
export const logPeriodItems = [{label: '今天', value: 'today'}, {label: '最近 7 天', value: '7d'},
  {label: '最近 30 天', value: '30d'}, {label: '自定义日期', value: 'custom'}]
