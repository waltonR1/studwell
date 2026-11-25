// 按公开路由类型查找详情页扩展。
import type {PublicPageStructure} from '#shared/types/public/website'

export interface RouteExtension {
 type:string
 setup(targetKey:string):{ready?:PromiseLike<unknown>;pageClass?:string;seo:()=>PublicPageStructure['seo']}
}

export function resolveRouteExtension(detailTemplates:readonly RouteExtension[],type:string){
 if(type==='page')return undefined
 const extension=detailTemplates.find(template=>template.type===type)
 if(!extension)throw new Error('Unregistered detail extension: '+type)
 return extension
}
