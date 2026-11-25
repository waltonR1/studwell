// 将发布页面及业务快照转换为搜索文档。
import {requiredLocalized} from '../policies/localized'
import {parseWebsiteRoutePattern} from '#shared/utils/website/route-pattern'
import {isNewsSearchPage} from './news-search-pages'
import {newsDetailPath} from '#shared/utils/website/news-route'
import type {PublicPage, PublicSiteSettings} from '#shared/types/public/website'
import type {PublicLocale} from '#shared/schemas/public/queries'
import type {PublicNewsRow} from '../repositories/public-news'
import type {SearchDocument} from '#shared/types/search'
import type {SectionField} from '#shared/types/website/section-template'
import {cleanSearchText,sectionSearchText} from '../policies/search-text'

export type SearchSnapshot = {
 locale:PublicLocale
 settings:PublicSiteSettings
 pages:Array<PublicPage & {searchFields:Record<string,SectionField>}>
 news?:Array<Pick<PublicNewsRow,'slug'|'content'|'categoryName'> & {id:string}>
}

export function createSearchDocuments({locale,settings,pages,news=[]}:SearchSnapshot):SearchDocument[]{
 const documents:Omit<SearchDocument,'locale'>[]=[]
 for(const page of pages){
  const structure=settings.pages[page.key]
  if(!structure||structure.releaseId!==page.releaseId||page.locale!==locale)throw new Error('Search snapshot is inconsistent')
  if(parseWebsiteRoutePattern(structure.path)?.parameter||structure.seo.indexable===false||!page.sections.length)continue
  const body=page.sections.map(section=>{
   const fields=page.searchFields[section.id]
   if(!fields)throw new Error('Missing published search field definition '+section.id)
   return sectionSearchText(fields,section.content)
  }).filter(Boolean).join(' ')
  documents.push({id:'page:'+page.key,type:'pages',path:structure.path,title:structure.seo.title,summary:structure.seo.description,body,categoryPath:[],aliases:[]})
 }
 const publishedPages=Object.values(settings.pages)
 const indexableDetails=publishedPages.filter(page=>page.seo.indexable!==false||!parseWebsiteRoutePattern(page.path)?.parameter)
 const listings=publishedPages.filter(page=>isNewsSearchPage(page)&&page.seo.indexable!==false)
 for(const article of news){
  const path=listings.map(page=>newsDetailPath(indexableDetails,page.path,article.slug)).find(Boolean)
  if(!path)continue
  const {title,summary,body}=requiredLocalized(article.content.localized,locale)
  documents.push({id:'news:'+article.id,type:'news',path,title,summary,
   body:body.map(block=>cleanSearchText((block.type==='image'?block.caption:block.text)??'')).filter(Boolean).join(' '),categoryPath:[requiredLocalized(article.categoryName,locale)],aliases:[],publishedAt:article.content.displayDate})
 }
 return documents.map(document=>({...document,locale}))
}
