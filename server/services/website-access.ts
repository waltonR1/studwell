// 复核官网管理权限及页面菜单范围，不处理请求认证。
import type {DatabaseExecutor} from '../db/transaction'
import type {WebsiteResource} from './website-read-model'
import {menuRepository} from '../repositories/menus'
import {websitePageKey} from '#shared/utils/website/page-layouts'
import {ApiError} from '../core/errors'
import {requirePermission} from './access/permissions'
export async function authorizeWebsite(db:DatabaseExecutor,actor:bigint,resource:WebsiteResource,operation:'read'|'update'|'publish'|'delete'){
 await requirePermission(db,actor,resource.type==='page'?`content.pages.${operation}`:`content.site_settings.${operation}`)
 // 页面操作权限与数据库菜单授权共同限定普通角色的页面访问范围。
 if(resource.type==='page')await authorizePageScope(db,actor,resource.key.slice(5))
}

export async function pageMenu(db:DatabaseExecutor,key:string,lock=false){
 const rows=await menuRepository.all(db)
 const candidates=rows.filter(r=>r.pageKey==='website_page'&&websitePageKey(r.code)===key)
 if(candidates.length!==1)throw new ApiError('NOT_FOUND')
 const row=lock?await menuRepository.byCode(db,candidates[0]!.code,true):candidates[0]!
 if(!row||row.pageKey!=='website_page')throw new ApiError('NOT_FOUND')
 return row
}
export async function authorizePageScope(db:DatabaseExecutor,actor:bigint,key:string){
 const current=await requirePermission(db,actor,'content.pages.read'),menu=await pageMenu(db,key)
 if(!current.isRoot&&!(await menuRepository.assigned(db,actor)).includes(menu.id))throw new ApiError('FORBIDDEN')
}
