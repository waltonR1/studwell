// 独立语言配置持久化；所有发布写入先获取全站协调锁，再锁定语言行。
import {eq,and} from 'drizzle-orm'
import {websiteLanguageConfig as config,websiteLanguageReleases as releases} from '../db/schema'
import {withEntityIds} from '../db/allocate-entity-id'
import {defaultSiteLanguages,type SiteLanguages} from '#shared/config/site-languages'
import type {DatabaseExecutor} from '../db/transaction'
export async function readLanguageConfig(db:DatabaseExecutor){return (await db.select().from(config).where(eq(config.id,1)))[0]??{id:1,version:1,languages:defaultSiteLanguages,publishedReleaseId:null}}
export async function lockLanguageConfig(db:DatabaseExecutor){await db.insert(config).values({id:1,version:1,languages:defaultSiteLanguages}).onDuplicateKeyUpdate({set:{id:1}});return (await db.select().from(config).where(eq(config.id,1)).for('update'))[0]!}
export async function languageRelease(db:DatabaseExecutor,id:bigint){return (await db.select().from(releases).where(eq(releases.id,id)))[0]}
export const languageReleases=(db:DatabaseExecutor)=>db.select().from(releases).orderBy(releases.id)
export async function saveLanguageConfig(db:DatabaseExecutor,version:number,value:{languages?:SiteLanguages;publishedReleaseId?:bigint}){const [r]=await db.update(config).set({...value,version:version+1}).where(and(eq(config.id,1),eq(config.version,version)));return r.affectedRows===1}
export async function appendLanguageRelease(db:DatabaseExecutor,actor:bigint,version:number,content:SiteLanguages,restoredFrom:bigint|null){const row=await withEntityIds(db,'website_language_releases',{version,content,restoredFrom,createdBy:actor});await db.insert(releases).values(row);return row}
