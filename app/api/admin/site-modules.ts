// 模块状态与启停接口，不持有业务状态或通知。
import type {SiteModuleName} from '#shared/config/site-modules'
import type {SiteModuleState,SiteModuleUpdate} from '#shared/types/admin/site-modules'
import type {AdminApiClient} from '~/types/admin/api'
export function createSiteModulesApi(api:AdminApiClient){return {
 read:(module:SiteModuleName)=>api.read<SiteModuleState>(`site-modules/${module}`),
 update:(module:SiteModuleName,body:SiteModuleUpdate)=>api.mutate<SiteModuleState>(`site-modules/${module}`,'PUT',body),
}}
