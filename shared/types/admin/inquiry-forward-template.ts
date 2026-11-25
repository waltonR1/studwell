// 转发占位符类型从统一目录推导，不在解释器中重复声明。
import type {forwardTemplateTokens} from '../../config/admin/inquiry-forward-template'

export type ForwardToken = keyof typeof forwardTemplateTokens
