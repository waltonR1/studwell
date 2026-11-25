// 负责路由与 SEO 配置及发布历史的数据库查询与持久化，使用调用方传入的执行器，不决定 HTTP 响应或业务授权。
import {and,eq} from 'drizzle-orm'
import {websitePageSeo,websitePublishedSeo,websiteSiteConfig,websiteSiteConfigReleases} from '../db/schema'
import {withEntityIds} from '../db/allocate-entity-id'
import type {DatabaseExecutor} from '../db/transaction'
import type {WebsiteSeoEntry,WebsiteSiteConfigSnapshot} from '#shared/types/website/site-config'
export const seoIdentity=(row:Pick<WebsiteSeoEntry,'resourceId'>)=>row.resourceId
export const seoOwner=(row:Pick<WebsiteSeoEntry,'resourceId'>)=>`website:seo:${seoIdentity(row)}`
export async function readSeo(db:DatabaseExecutor,preview=false):Promise<WebsiteSeoEntry[]>{
 const rows=preview?await db.select().from(websitePageSeo):await db.select().from(websitePublishedSeo)
 return rows.map(row=>({...row,resourceId:String(row.resourceId),ogMediaId:row.ogMediaId===null?null:String(row.ogMediaId)}))
}
const value=(row:WebsiteSeoEntry)=>({...row,resourceId:BigInt(row.resourceId),ogMediaId:row.ogMediaId?BigInt(row.ogMediaId):null})
export async function saveSeo(db:DatabaseExecutor,entries:WebsiteSeoEntry[]){for(const row of entries)await db.insert(websitePageSeo).values(value(row)).onDuplicateKeyUpdate({set:value(row)})}
export async function replacePublishedSeo(db:DatabaseExecutor,entries:WebsiteSeoEntry[]){await db.delete(websitePublishedSeo);if(entries.length)await db.insert(websitePublishedSeo).values(entries.map(value))}
export async function lockSiteConfig(db:DatabaseExecutor){
 await db.insert(websiteSiteConfig).values({id:1,version:1}).onDuplicateKeyUpdate({set:{id:1}})
 return (await db.select().from(websiteSiteConfig).where(eq(websiteSiteConfig.id,1)).for('update'))[0]!
}
export async function readSiteConfig(db:DatabaseExecutor){return (await db.select().from(websiteSiteConfig).where(eq(websiteSiteConfig.id,1)))[0]??{id:1,version:1,publishedReleaseId:null}}
export async function bumpSiteConfig(db:DatabaseExecutor,version:number,publishedReleaseId?:bigint){
 const [result]=await db.update(websiteSiteConfig).set({version:version+1,...(publishedReleaseId===undefined?{}:{publishedReleaseId})}).where(and(eq(websiteSiteConfig.id,1),eq(websiteSiteConfig.version,version)))
 return result.affectedRows===1
}
export const configReleases=(db:DatabaseExecutor)=>db.select().from(websiteSiteConfigReleases).orderBy(websiteSiteConfigReleases.id)
export async function configRelease(db:DatabaseExecutor,id:bigint){return (await db.select().from(websiteSiteConfigReleases).where(eq(websiteSiteConfigReleases.id,id)))[0]}
export async function appendConfigRelease(db:DatabaseExecutor,actor:bigint,version:number,content:WebsiteSiteConfigSnapshot,restoredFrom:bigint|null=null){
 const row=await withEntityIds(db,'website_site_config_releases',{version,content,createdBy:actor,restoredFrom})
 await db.insert(websiteSiteConfigReleases).values(row);return row
}
export async function removePageSeo(db:DatabaseExecutor,resourceId:bigint){await db.delete(websitePageSeo).where(eq(websitePageSeo.resourceId,resourceId))}
