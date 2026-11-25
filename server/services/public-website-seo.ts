// 解析公开页面或详情目标的 SEO，不处理 HTTP 标签渲染。
import type { PublicSeo } from '#shared/types/public/website'
import type { DatabaseExecutor } from '../db/transaction'
import type { readSeo } from '../repositories/website-site-config'
import {seoFor} from '../policies/website-seo'
import { createPublicMediaResolver } from './public-media'
export async function resolveSeo(db:DatabaseExecutor,rows:Awaited<ReturnType<typeof readSeo>>,resourceId:string,locale:Parameters<typeof seoFor>[2]):Promise<PublicSeo>{
 const seo=seoFor(rows,resourceId,locale)
 const row=rows.find(row=>row.resourceId===resourceId&&row.locale===locale)
 if(row?.ogMediaId)seo.ogImage=await createPublicMediaResolver(db)(String(row.ogMediaId),'image')
 return seo
}
