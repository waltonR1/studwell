import type {SiteModuleName} from '#shared/config/site-modules'
// 纯策略：模块关联来自调用方提供的数据库规则，不识别页面或模板代称。
import type {WebsiteModulePolicy} from '#shared/schemas/website/module-policy'
export function modulePolicyChecks(policy:WebsiteModulePolicy){
 const enabled=(modules:readonly SiteModuleName[])=>modules.every(module=>policy.enabled[module])
 const template=(key:string)=>enabled(policy.templates[key]?.modules??[])
 return {
  page:(key:string)=>enabled(policy.pages[key]??[]),template,
  snapshot:(content:unknown)=>((content as {sections?:Array<{visible:boolean;templateKey:string}>})?.sections??[]).every(section=>!section.visible||template(section.templateKey)),
 }
}
