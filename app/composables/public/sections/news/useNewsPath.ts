// 解析新闻列表及详情链接使用的公开路径。
import {inject,type InjectionKey} from 'vue'
import {useSiteSettings} from '~/composables/public/runtime/useSiteSettings'
import {useCurrentPublicPage} from '~/composables/public/runtime/usePublicPage'
import {newsDetailPath,newsListingPath} from '#shared/utils/website/news-route'
function liveNewsPath(listing?:()=>string|undefined){

 const {settings}=useSiteSettings(),context=useCurrentPublicPage()
 return (slug?:string)=>{

  const pages=settings.value?.pages??{}
  const current=context?pages[context.key]:undefined
  const path=listing?listing():newsListingPath(current)||current?.path
  if(!path)return ''
  return slug?newsDetailPath(Object.values(pages),path,slug):path
 }
}

export const newsPathSource:InjectionKey<typeof liveNewsPath>=Symbol('NewsPath')
export function useNewsPath(listing?:()=>string|undefined){return inject(newsPathSource,liveNewsPath)(listing)}
