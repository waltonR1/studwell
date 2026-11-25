import type {AdminApiClient} from '~/types/admin/api'
import type {WebsitePublication,WebsiteReleaseDetail} from '#shared/types/admin/website'
import type {z} from 'zod'
import type {websiteWithdrawSchema,websitePublishSchema,websiteRestoreSchema} from '#shared/schemas/admin/website'
export function createWebsiteResourcesApi(api:AdminApiClient){
 const path=(key:string)=>`website-resources/${encodeURIComponent(key)}`
 return {withdraw:(key:string,body:z.infer<typeof websiteWithdrawSchema>)=>api.mutate<WebsitePublication>(`${path(key)}/withdraw`,'POST',body),history:(key:string)=>api.read<WebsitePublication>(`${path(key)}/releases`),detail:(key:string,id:string)=>api.read<WebsiteReleaseDetail>(`${path(key)}/releases/${id}`),publish:(key:string,body:z.infer<typeof websitePublishSchema>)=>api.mutate<WebsitePublication>(`${path(key)}/publish`,'POST',body),restore:(key:string,body:z.infer<typeof websiteRestoreSchema>)=>api.mutate<WebsitePublication>(`${path(key)}/restore`,'POST',body)}
}
