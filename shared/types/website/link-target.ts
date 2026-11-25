// 通用站内目标合同直接从输入校验推导，不依赖链接计算实现或具体业务。
import type {LinkTarget} from '../../schemas/website/link-target'

export type SitePageTarget = Exclude<LinkTarget, { type: 'custom' }>
