// 解析入口区块的目标地址，处理站内与站外跳转。
import type {PublicSection,PublicPageStructure} from '#shared/types/public/website'
import {isExternalSiteLink,isSiteLinkAddress} from '#shared/utils/website/site-link'

type EntryPage=Pick<PublicPageStructure,'key'|'path'|'sections'>

export function pageEntryRedirect(destination:string|undefined,pageKey:string,pages:Record<string,EntryPage>){
 if(!destination||!isSiteLinkAddress(destination))return
 if(isExternalSiteLink(destination))return {external:true as const,to:destination}
 const url=new URL(destination,'https://site.invalid')
 const target=Object.values(pages).find(page=>page.path===url.pathname)
 if(!target||target.key===pageKey||target.sections.some(section=>section.capabilities.includes('page.redirect')))return
 const query:Record<string,string|string[]>={}
 for(const key of new Set(url.searchParams.keys())){
  const values=url.searchParams.getAll(key)
  query[key]=values.length===1?values[0]!:values
 }
 return {external:false as const,to:{path:target.path,query,hash:url.hash}}
}

export const entryBehavior={
 capability:'page.redirect',
 resolve(section:PublicSection,pageKey:string,pages:Record<string,PublicPageStructure>){
  const data=section.content.data as {targetResourceId?:string}|undefined
  return pageEntryRedirect(data?.targetResourceId,pageKey,pages)
 },
}
