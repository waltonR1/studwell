// 按引用来源批量读取名称和冻结字段合同，不决定展示文案或业务授权。
import {eq,inArray,and} from 'drizzle-orm'
import type {DatabaseExecutor} from '../db/transaction'
import {websiteResources,websiteSections,websiteTemplates,websiteTemplateRevisions,websiteReleases,websiteSiteConfig,websiteSiteConfigReleases,adminMenus,newsArticles,newsReleases} from '../db/schema'

export async function readMediaReferenceContext(db:DatabaseExecutor,owners:string[]) {
    const ids=(prefix:string)=>[...new Set(owners.filter(owner=>owner.startsWith(prefix)).map(owner=>owner.slice(prefix.length)).filter(id=>/^[1-9]\d*$/.test(id)))].map(BigInt)
    const sectionIds=ids('website:section:'),releaseIds=ids('website:release:'),templateIds=ids('website:template:'),configIds=ids('website:config:'),articleIds=ids('news:draft:'),newsIds=ids('news:release:')
    const resources=await db.select({id:websiteResources.id,key:websiteResources.key,type:websiteResources.type,publishedReleaseId:websiteResources.publishedReleaseId}).from(websiteResources)
    const menus=await db.select({code:adminMenus.code,name:adminMenus.name}).from(adminMenus).where(eq(adminMenus.pageKey,'website_page'))
    const sections=sectionIds.length?await db.select({section:websiteSections,templateName:websiteTemplates.name,definition:websiteTemplateRevisions.definition}).from(websiteSections).innerJoin(websiteTemplates,eq(websiteTemplates.id,websiteSections.templateId)).innerJoin(websiteTemplateRevisions,and(eq(websiteTemplateRevisions.templateId,websiteSections.templateId),eq(websiteTemplateRevisions.version,websiteSections.templateRevision))).where(inArray(websiteSections.id,sectionIds)):[]
    const releases=releaseIds.length?await db.select().from(websiteReleases).where(inArray(websiteReleases.id,releaseIds)):[]
    const templates=templateIds.length?await db.select({id:websiteTemplates.id,name:websiteTemplates.name}).from(websiteTemplates).where(inArray(websiteTemplates.id,templateIds)):[]
    const configurations=configIds.length?await db.select().from(websiteSiteConfigReleases).where(inArray(websiteSiteConfigReleases.id,configIds)):[]
    const [configuration]=configIds.length?await db.select().from(websiteSiteConfig).where(eq(websiteSiteConfig.id,1)):[]
    const articles=articleIds.length?await db.select({id:newsArticles.id,slug:newsArticles.slug,content:newsArticles.content}).from(newsArticles).where(inArray(newsArticles.id,articleIds)):[]
    const news=newsIds.length?await db.select({release:newsReleases,currentReleaseId:newsArticles.publishedReleaseId}).from(newsReleases).innerJoin(newsArticles,eq(newsArticles.id,newsReleases.articleId)).where(inArray(newsReleases.id,newsIds)):[]
    return {resources,menus,sections,releases,templates,configurations,configuration,articles,news}
}
