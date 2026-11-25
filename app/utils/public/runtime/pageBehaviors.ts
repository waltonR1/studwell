// 按区块业务能力登记的行为解析页面跳转。
import type {PublicSection,PublicPageStructure} from '#shared/types/public/website'
type PageRedirect =
 | {external:true;to:string}
 | {external:false;to:{path:string;query:Record<string,string|string[]>;hash:string}}

export interface PageBehavior {
 capability:string
 resolve(section:PublicSection,pageKey:string,pages:Record<string,PublicPageStructure>):PageRedirect|undefined
}

export function resolvePageBehavior(sectionBehaviors:readonly PageBehavior[],sections:PublicSection[],pageKey:string,pages:Record<string,PublicPageStructure>){
 for(const section of sections){
  const behavior=sectionBehaviors.find(behavior=>section.capabilities.includes(behavior.capability))
  const result=behavior?.resolve(section,pageKey,pages)
  if(result)return result
 }
}
