// 从发布页面生成导航链接和目标投影。
import {internalLinkTargetSchema} from '#shared/schemas/website/link-target'
import type {LinkTarget} from '#shared/schemas/website/link-target'
type InternalTarget=Exclude<LinkTarget,{type:'custom'}>
export const publishedNavigationLinks=(value:unknown):Array<{target:InternalTarget;visible:boolean}>=>{
 if(!value||typeof value!=='object')return []
 if(Array.isArray(value))return value.flatMap(publishedNavigationLinks)
 const object=value as Record<string,unknown>
 if(object.visible===false)return []
 const parsed=internalLinkTargetSchema.safeParse({type:object.type,resourceId:object.resourceId,module:object.module,value:object.value})
 if(parsed.success)return [{target:parsed.data,visible:true}]
 return Object.values(object).flatMap(publishedNavigationLinks)
}
export const publishedPageTargets=(value:unknown)=>new Set((value as {sections:Array<{anchorKey:string;visible:boolean}>}).sections.filter(section=>section.visible).map(section=>section.anchorKey))
