// 将新闻详情加载与 SEO 接入公开路由扩展。
import {useNewsDetail} from '~/composables/public/sections/news/useNewsDetail'
import {provideNewsArticle} from './articleContext'

export const newsRoute={
 type:'news',
 setup(targetKey:string){
  const {article,ready}=useNewsDetail(targetKey)
  provideNewsArticle(article)
  return {ready, pageClass:'news-page', seo:()=>({
   title:article.value?.seoTitle??'',description:article.value?.seoDescription??'',
  })}
 },
}
