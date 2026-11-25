// 站内链接目标查询接口；独立于页面和站点设置草稿。
import type {AdminApiClient} from '~/types/admin/api'
import type {SiteTarget} from '#shared/types/admin/site-settings'

export function createSiteNavigationTargetsApi(api:AdminApiClient){
 return {read:()=>api.read<SiteTarget[]>('navigation-targets')}
}
