// 根据站内导航目标计算稳定标识，不读取数据库或发布状态。
import type {SiteLink} from '#shared/schemas/admin/site-settings'

export const siteTargetKey = (target: Exclude<SiteLink['target'], {type: 'custom'}>) => `${target.type}:${target.module}:${target.value}`
