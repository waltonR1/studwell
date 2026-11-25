// 新闻预览适配：提供文章、列表和链接上下文，隔离正式新闻请求。
import {computed,provide,ref,toValue,type MaybeRefOrGetter} from 'vue'
import {adminContentLocale} from '#shared/config/site-languages'
import type {WebsitePreviewData} from '#shared/types/admin/website-preview'
import type {PublicSiteSettings} from '#shared/types/public/website'
import {provideNewsArticle} from '~/composables/public/sections/news/articleContext'
import {homeNewsSource} from '~/composables/public/sections/news/useHomeNews'
import {newsCatalogSource} from '~/composables/public/sections/news/useNewsCatalog'
import {newsPathSource} from '~/composables/public/sections/news/useNewsPath'
import {useCurrentPublicPage} from '~/composables/public/runtime/usePublicPage'
import {newsDetailPath,newsListingPath} from '#shared/utils/website/news-route'
export function provideNewsPreview(source:MaybeRefOrGetter<Pick<WebsitePreviewData,'article'>>,settings?:PublicSiteSettings){
 const sample=computed(()=>toValue(source))
 const items=computed(()=>sample.value.article?[sample.value.article]:[])
 const categories=computed(()=>sample.value.article?[sample.value.article.category]:[])
 provideNewsArticle(computed(()=>sample.value.article??null))
 provide(homeNewsSource,async()=>({available:computed(()=>!!sample.value.article),featured:computed(()=>sample.value.article),remaining:computed(()=>[])}))
 provide(newsCatalogSource,async()=>({
  list:computed(()=>({items:items.value,categories:categories.value,locale:settings?.locale??adminContentLocale,total:items.value.length,page:1,pageSize:12})),error:ref(),pending:ref(false),selectedCategory:computed(()=>undefined),page:computed(()=>1),
 }))
 provide(newsPathSource,listing=>{
  const context=useCurrentPublicPage()
  return slug=>{
   const pages=settings?.pages??{}
   const current=context?.snapshot.value?.structure
   const path=listing?listing():newsListingPath(current)||current?.path
   if(!path)return ''
   return slug?newsDetailPath(Object.values(pages),path,slug):path
  }
 })
}
