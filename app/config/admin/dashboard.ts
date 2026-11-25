// 后台仪表盘的名称、说明与跳转配置。
import type {DashboardMetricDefinition} from '~/types/admin/dashboard'

export const dashboardMetrics: readonly DashboardMetricDefinition[] = [
    {key: 'users', label: '账号总数', path: '/admin/users', note: '包含Root及禁用账号，不含已删除账号'},
    {key: 'roles', label: '角色总数', path: '/admin/roles', note: '包含启用及禁用角色'},
    {key: 'dictionaries', label: '字典类型数', path: '/admin/dictionaries', note: '包含启用及禁用类型'},
    {
        key: 'loginSuccess',
        label: '今日登录成功',
        path: '/admin/logs/login',
        note: '北京时间今天的登录成功次数，不含退出',
        query: {period: 'today', action: 'login', result: 'success'}
    },
    {
        key: 'loginFailed',
        label: '今日登录失败',
        path: '/admin/logs/login',
        note: '北京时间今天的登录失败次数',
        query: {period: 'today', action: 'login', result: 'failed'}
    },
    {
        key: 'auditToday',
        label: '今日重要操作',
        path: '/admin/logs/audit',
        note: '北京时间今天的操作审计记录，含成功和失败',
        query: {period: 'today'}
    },
    {
        key: 'securityToday',
        label: '今日安全事件',
        path: '/admin/logs/security',
        note: '北京时间今天的认证安全事件，含改密及目录同步',
        query: {period: 'today'}
    },
]
