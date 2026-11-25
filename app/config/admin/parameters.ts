// 后台参数页面的分组名称与说明。
import type {ParameterGroup} from '#shared/types/admin/parameters.ts'

export const parameterGroups: Array<{ key: ParameterGroup; name: string; description: string }> = [
    {key: 'general', name: '常规参数', description: '管理列表和日志导出的默认行为。'},
    {key: 'session', name: '会话安全', description: '修改仅影响之后创建的会话，现有会话保持原有效期。'},
    {key: 'password', name: '密码安全', description: '修改影响之后创建、重置和修改密码，不影响已有密码登录。'},
    {key: 'rate', name: '访问限制', description: '修改后下一请求生效；计数使用新策略独立统计。'},
]
