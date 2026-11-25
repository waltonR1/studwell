import type {AdminApiClient} from '~/types/admin/api'
import type {NewsArticle,NewsArticleList,NewsCategory,NewsRelease,NewsOperations} from '#shared/types/admin/news'
import type {NewsArticleInput,NewsCategoryInput} from '#shared/schemas/admin/news'
import type {WebsitePagePreviewView} from '#shared/types/admin/website-preview'
import type {SiteLocale} from '#shared/schemas/admin/site-settings'
const state=(a:NewsArticle)=>({version:a.version,stateVersion:a.stateVersion,publishedReleaseId:a.publishedReleaseId})
export function createNewsApi(api:AdminApiClient){return {
 detailLayout:(locale:SiteLocale)=>api.read<WebsitePagePreviewView>('news/detail-layout',{locale}),
 categories:()=>api.read<NewsCategory[]>('news/categories'),
 categorySave:(id:string|null,value:NewsCategoryInput & {version?:number})=>api.mutate<NewsCategory>('news/categories','PUT',{...value,id}),
 categoryDelete:(id:string,version:number)=>api.mutate(`news/categories/${id}`,'DELETE',{version}),
 categoryMove:(c:NewsCategory,neighbor:NewsCategory,direction:'up'|'down')=>api.mutate<NewsCategory[]>(`news/categories/${c.id}/move`,'POST',{version:c.version,neighborId:neighbor.id,neighborVersion:neighbor.version,direction}),
 list:(q:Record<string,string|number|undefined>)=>api.read<NewsArticleList>('news/articles',q),
 detail:(id:string)=>api.read<NewsArticle>(`news/articles/${id}`),
 save:(id:string|null,value:NewsArticleInput & {version?:number})=>api.mutate<NewsArticle>(`news/articles${id?'/'+id:''}`,id?'PUT':'POST',value),
 action:(a:NewsArticle,action:'publish'|'restore'|'withdraw'|'delete',releaseId?:string)=>api.mutate<NewsArticle>(`news/articles/${a.id}${action==='delete'?'':'/'+action}`,action==='delete'?'DELETE':'POST',{...state(a),...(releaseId?{releaseId}:{})}),
 release:(id:string,releaseId:string)=>api.read<NewsRelease>(`news/articles/${id}/releases/${releaseId}`),
 operations:()=>api.read<NewsOperations>('news/operations'),
 saveOperations:(settings:NewsOperations)=>api.mutate<NewsOperations>('news/operations','PUT',settings),
}}
