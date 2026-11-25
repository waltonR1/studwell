// 后台安全参数的关联约束，供页面提交预检与服务端保存、回退判断共用。
import type {ParameterGroup, ParameterValue} from '../../types/admin/parameters'

export function parameterRelations(values: Record<string, ParameterValue>, group?: ParameterGroup): string | null {
    if ((!group || group === 'session') && Number(values['security.session.idleSeconds']) > Number(values['security.session.absoluteSeconds'])) return '空闲时限不能大于登录会话最长有效期。'
    if ((!group || group === 'password') && Number(values['security.password.minLength']) > Number(values['security.password.maxLength'])) return '密码最少字符数不能大于最多字符数。'
    return null
}
