// 协调页面菜单可见性与发布依赖检查，锁定相关菜单状态。
import type {DatabaseExecutor} from '../db/transaction'
import {menuRepository,type MenuRow} from '../repositories/menus'
import {websiteResourceRepository} from '../repositories/website-resources'
import {websitePageKey} from '#shared/utils/website/page-layouts'
import {ApiError} from '../core/errors'

export function hiddenPageAncestor(rows:readonly MenuRow[],row:MenuRow){
 const byId=new Map(rows.map(menu=>[menu.id,menu]))
 let current:MenuRow|undefined=row
 const seen=new Set<bigint>()
 while(current&&!seen.has(current.id)){
  seen.add(current.id)
  if(!current.visible)return current
  current=current.parentId===null?undefined:byId.get(current.parentId)
 }
}
export function hidePageReason(rows:readonly MenuRow[],id:bigint,publishedKeys:ReadonlySet<string>){
 const descendants=new Set([id])
 for(let i=0;i<rows.length;i++)for(const row of rows)if(row.parentId!==null&&descendants.has(row.parentId))descendants.add(row.id)
 const published=rows.filter(row=>descendants.has(row.id)&&row.pageKey==='website_page'&&publishedKeys.has('page.'+websitePageKey(row.code)))
 return published.length?'请先在页面维护中下线，再隐藏菜单：'+published.map(row=>row.name).join('、'):undefined
}
export async function assertVisiblePublishedPages(db:DatabaseExecutor,rows:readonly MenuRow[]){
 const keys=new Set((await websiteResourceRepository.all(db)).filter(row=>row.type==='page'&&row.publishedReleaseId).map(row=>row.key))
 const blocked=rows.find(row=>row.pageKey==='website_page'&&keys.has('page.'+websitePageKey(row.code))&&hiddenPageAncestor(rows,row))
 if(blocked)throw new ApiError('INVALID_INPUT',[{path:'visible',message:'请先在页面维护中下线，再隐藏或移动菜单：'+blocked.name}])
}
export async function lockVisiblePageMenu(db:DatabaseExecutor,key:string){
 const rows=await menuRepository.all(db,true)
 const menu=rows.find(row=>row.pageKey==='website_page'&&websitePageKey(row.code)===key)
 if(!menu)throw new ApiError('NOT_FOUND')
 if(hiddenPageAncestor(rows,menu))throw new ApiError('INVALID_INPUT',[{path:'menu',message:'请先显示页面菜单及全部上级菜单，再发布页面。'}])
}
