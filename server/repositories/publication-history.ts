// 在调用方持有所属对象锁后清理单条快照及恢复来源指针，不涉及权限或文件删除。
import {and,eq,lt,sql} from 'drizzle-orm'
import {websiteReleases,websiteResources,newsReleases,newsArticles,websiteLanguageReleases,websiteSiteConfigReleases} from '../db/schema'
import {MAX_ENTITY_VERSION} from '#shared/config/entity-versions'
import type {DatabaseExecutor} from '../db/transaction'

export const publicationHistoryRepository={
 async website(db:DatabaseExecutor,resourceId:bigint,releaseId:bigint){
  await db.update(websiteReleases).set({restoredFrom:null}).where(and(eq(websiteReleases.resourceId,resourceId),eq(websiteReleases.restoredFrom,releaseId)))
  await db.delete(websiteReleases).where(and(eq(websiteReleases.resourceId,resourceId),eq(websiteReleases.id,releaseId)))
  const [result]=await db.update(websiteResources).set({stateVersion:sql`${websiteResources.stateVersion}+1`}).where(and(eq(websiteResources.id,resourceId),lt(websiteResources.stateVersion,MAX_ENTITY_VERSION)))
  return result.affectedRows===1
 },
 async news(db:DatabaseExecutor,articleId:bigint,releaseId:bigint){
  await db.update(newsReleases).set({restoredFrom:null}).where(and(eq(newsReleases.articleId,articleId),eq(newsReleases.restoredFrom,releaseId)))
  await db.delete(newsReleases).where(and(eq(newsReleases.articleId,articleId),eq(newsReleases.id,releaseId)))
  const [result]=await db.update(newsArticles).set({stateVersion:sql`${newsArticles.stateVersion}+1`}).where(and(eq(newsArticles.id,articleId),lt(newsArticles.stateVersion,MAX_ENTITY_VERSION)))
  return result.affectedRows===1
 },
 async languages(db:DatabaseExecutor,releaseId:bigint){
  await db.update(websiteLanguageReleases).set({restoredFrom:null}).where(eq(websiteLanguageReleases.restoredFrom,releaseId))
  await db.delete(websiteLanguageReleases).where(eq(websiteLanguageReleases.id,releaseId))
 },
 async routes(db:DatabaseExecutor,releaseId:bigint){
  await db.update(websiteSiteConfigReleases).set({restoredFrom:null}).where(eq(websiteSiteConfigReleases.restoredFrom,releaseId))
  await db.delete(websiteSiteConfigReleases).where(eq(websiteSiteConfigReleases.id,releaseId))
 },
}
