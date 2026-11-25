// 组合新闻详情布局与文章数据用于后台预览，不发布文章。
import {readSiteLanguages} from './site-languages'
import type {Database} from '../db/transaction'
import {requirePermission} from './access/permissions'
import {parseInput} from '../core/validation'
import {publicLocalizedQuerySchema} from '#shared/schemas/public/queries'
import {websiteResourceRepository} from '../repositories/website-resources'
import {snapshotHasCapability} from './website-capabilities'
import {projectWebsitePagePreview} from './website-page-preview'
import {ApiError} from '../core/errors'

export async function previewNewsArticleLayout(db:Database,actor:bigint,query:unknown){
 const {locale}=await parseInput(publicLocalizedQuerySchema,query)
 return db.transaction(async tx=>{
  await requirePermission(tx,actor,'content.news.read')
  const matches=[]
  for(const resource of await websiteResourceRepository.all(tx)){
   if(resource.type!=='page'||!resource.publishedReleaseId)continue
   const release=await websiteResourceRepository.release(tx,resource.publishedReleaseId,resource.id)
   if(await snapshotHasCapability(tx,release?.content,'news.article'))matches.push(resource)
  }
  if(!matches.length)throw new ApiError('NOT_FOUND')
  if(matches.length!==1)throw new ApiError('INVALID_INPUT',[{path:'layout',message:'存在多个已发布的新闻详情布局，请明确使用的布局。'}])
  return projectWebsitePagePreview(tx,matches[0]!,locale??(await readSiteLanguages(tx,true)).defaultLocale,'published')
 },{isolationLevel:'repeatable read'})
}
