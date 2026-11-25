// 限流作用域及名称；运行策略由数据库参数决定。
export const rateScopes = [
    ['bootstrap', '登录会话初始化'],
    ['login-ip', '按来源 IP 登录'],
    ['login-account', '按账号登录'],
    ['change-password', '本人修改密码'],
    ['session-status', '会话状态查询'],
    ['admin-api', '后台接口访问'],
    ['media-read', '后台媒体文件读取'],
    ['public-inquiry', '官网客户咨询提交'],
    ['csrf-log', '安全校验拒绝记录'],
    ['rbac-log', '权限拒绝记录'],
] as const
