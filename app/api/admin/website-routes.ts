// 路由与 SEO 的读写、启停及发布接口，不持有编辑状态。
import type {z} from 'zod'
import type {siteConfigVersionSchema,websiteSeoUpdateSchema} from '#shared/schemas/admin/website-site-config'
import type {WebsiteSiteConfigTree} from '#shared/types/admin/website-site-config'
import type {WebsiteRouteNode} from '#shared/types/website/route'
import type {AdminApiClient} from '~/types/admin/api'
type Mutation=
 | {action:'save';version:number;id:string|null;parentId:string|null;slug:string;targetType:WebsiteRouteNode['targetType'];resourceId:string|null}
 | {action:'delete';version:number;id:string}
 | {action:'set-enabled';version:number;id:string;enabled:boolean}
 | z.infer<typeof websiteSeoUpdateSchema>
export function createWebsiteRoutesApi(api:AdminApiClient){return {
 read:()=>api.read<WebsiteSiteConfigTree>('website-routes'),
 mutate:(body:Mutation)=>api.mutate<WebsiteSiteConfigTree>('website-routes','PUT',body),
 publish:(body:z.infer<typeof siteConfigVersionSchema>)=>api.mutate('website-routes/publish','POST',body),
}}
