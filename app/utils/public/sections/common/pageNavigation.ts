// 解析页面组导航的链接与当前选中状态。
import {isExternalSiteLink,isSiteLinkAddress} from '#shared/utils/website/site-link'
type Query=Record<string,unknown>
export function pageNavigation(links:Array<{resourceId:string;label:string}>,current:{path:string;query:Query;hash:string}){
 const result=links.flatMap(({resourceId:address,label},index)=>{
  if(!address||!isSiteLinkAddress(address))return []
  const external=isExternalSiteLink(address),url=new URL(address,'https://site.invalid')
  const matches=!external&&url.pathname===current.path&&(!url.hash||url.hash===current.hash)&&[...new Set(url.searchParams.keys())].every(key=>{
   const actual=current.query[key],values=Array.isArray(actual)?actual.map(String):actual==null?[]:[String(actual)]
   return JSON.stringify(values)===JSON.stringify(url.searchParams.getAll(key))
  })
  return [{key:index+':'+address,address,label,score:matches?1+[...url.searchParams.keys()].length+(url.hash?100:0):0,active:false}]
 })
 const selected=result.reduce<typeof result[number]|undefined>((best,link)=>link.score>0&&(!best||link.score>best.score)?link:best,undefined)
 if(selected)selected.active=true
 return result
}
