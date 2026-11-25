// 咨询转发邮件模板的变量提取、替换与格式预检，不连接邮件服务。
import {forwardTemplateTokens} from '../../config/admin/inquiry-forward-template'
import type {ForwardToken} from '../../types/admin/inquiry-forward-template'

const placeholder = /\{\{\s*([a-z]+)\s*\}\}/g

export function forwardTemplateProblem(template: string, allowed: readonly ForwardToken[], limit: number) {
    let expandedLength = 0
    let unsupported = false
    const literal = template.replace(placeholder, (_, key: ForwardToken) => {
        if (!allowed.includes(key)) unsupported = true
        else expandedLength += forwardTemplateTokens[key].max
        return ''
    })
    if (unsupported || /\{\{|\}\}/.test(literal)) return '存在无法识别或当前模板不允许使用的占位符。'
    if (literal.length + expandedLength > limit) return '替换占位符后的邮件内容可能过长，请缩短文案。'
    return ''
}

export function renderForwardTemplate(template: string, values: Partial<Record<ForwardToken, string>>) {
    return template.replace(placeholder, (original, key: ForwardToken) => Object.hasOwn(values, key) ? values[key] ?? '' : original)
}
