// 将新闻草稿投影为公开文章展示数据；媒体权限和地址解析由调用方传入，不请求接口。
import {emptyNewsContent,type NewsContent} from '#shared/schemas/admin/news'
import type {SiteLocale} from '#shared/schemas/admin/site-settings'
import type {PublicNewsArticle,PublicNewsBlock} from '#shared/types/public/news'
import type {ModuleImageRules} from '#shared/schemas/admin/image-rules'
export function projectNewsArticlePreview(content:NewsContent,locale:SiteLocale,canReadMedia:boolean,rules:ModuleImageRules|undefined,mediaUrl:(id:string)=>string):PublicNewsArticle{
 const text=content.localized[locale]??emptyNewsContent(content.categoryId).localized[locale]!
 const title=text.title||'未填写标题'
 const body=text.body.flatMap((block):PublicNewsBlock[]=>{
  if(block.type!=='image')return [block]
  if(!canReadMedia||!block.image.mediaId)return []
  return [{type:'image',caption:block.caption,image:{src:mediaUrl(block.image.mediaId),alt:block.image.alt,presentation:block.image.presentation,imagePreset:rules?.newsBody}}]
 })
 return {
  id:'preview',slug:'preview',category:{id:'',name:''},title,summary:text.summary,publishedAt:content.displayDate,
  coverImage:canReadMedia&&content.coverMediaId?{src:mediaUrl(content.coverMediaId),alt:title,presentation:content.coverPresentation,imagePreset:rules?.newsCover}:null,
  body,viewCount:null,seoTitle:text.seoTitle,seoDescription:text.seoDescription,
  source:text.sourceName||text.sourceUrl?{name:text.sourceName,url:text.sourceUrl}:null,
 }
}
