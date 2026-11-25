// 协调招聘岗位业务规则、权限及持久化调用，不直接处理 HTTP 或 ORM。
import {adminContentLocale} from '#shared/config/site-languages'
import {lockSiteConfig} from '../repositories/website-site-config'
import {readSiteLanguages} from './site-languages'
import {isDeepStrictEqual} from 'node:util'
import {careerRepository as repo,type CareerPositionRow} from '../repositories/careers'
import type {Database,DatabaseExecutor} from '../db/transaction'
import type {AuthMeta} from '../core/auth-context'
import {ApiError,conflictError} from '../core/errors'
import {requirePermission} from './access/permissions'
import {auditedWrite} from './operations/audited-write'
import {auditService} from './audit'
import {auditChanges} from '../policies/audit-changes'
import {parseInput} from '../core/validation'
import {careerMoveSchema,careerPositionQuerySchema,type CareerContent,type AdminCareerPosition} from '#shared/schemas/admin/careers'
import type {PageData} from '#shared/types/api'

const dto=(p:CareerPositionRow,live?:CareerContent):AdminCareerPosition=>({
 id:String(p.id),content:p.draft,version:p.version,publishedReleaseId:p.publishedReleaseId?String(p.publishedReleaseId):null,
 changed:!live||!isDeepStrictEqual(p.draft,live),
})
export async function appendCareerRelease(db:DatabaseExecutor,id:bigint,content:CareerContent,actor:bigint){
 return repo.append(db,{positionId:id,content,sortOrder:content.sortOrder,createdBy:actor})
}
type Mutation={content:CareerContent;version?:number}|{version:number;publishedReleaseId:string|null}
export function createCareerService(db:Database){
 return {
  async list(actor:bigint,raw:unknown={}):Promise<PageData<AdminCareerPosition>>{
   await requirePermission(db,actor,'content.careers.read')
   const query=await parseInput(careerPositionQuerySchema,raw)
   const rows=await repo.list(db)
   const term=query.search.toLocaleLowerCase()
   const filtered=rows.map(row=>dto(row.position,row.content??undefined))
    .filter(item=>query.status==='all'||(query.status==='published'?!!item.publishedReleaseId:!item.publishedReleaseId))
    .filter(item=>!term||Object.values(item.content.localized).some(value=>
      [value.title,value.department,value.location].some(text=>text.toLocaleLowerCase().includes(term))))
    .sort((a,b)=>a.content.sortOrder-b.content.sortOrder||a.id.localeCompare(b.id))
   const start=(query.page-1)*query.pageSize
   return {items:filtered.slice(start,start+query.pageSize),total:filtered.length,page:query.page,pageSize:query.pageSize}
  },
  async mutate(actor:bigint,meta:AuthMeta,action:'create'|'update'|'publish'|'withdraw',id:string|null,input:Mutation){
   return auditedWrite(db,{actor,meta,action:'careers.position.'+action,id,targetType:'careers',isolationLevel:'read committed'},async tx=>{
    await requirePermission(tx,actor,action==='create'||action==='update'?'content.careers.update':'content.careers.publish')
    if(action==='publish')await lockSiteConfig(tx)
    const old=id?await repo.lock(tx,BigInt(id)):undefined
    if(id&&!old)throw new ApiError('NOT_FOUND')
    if(old&&(old.version!==input.version||old.version>=4294967295))throw conflictError('STALE','version')
    let positionId:bigint
    if(!old&&'content' in input){
     const rows=await repo.lockList(tx)
     const sortOrder=Math.min(1_000_000,Math.max(-10,...rows.map(row=>row.draft.sortOrder))+10)
     positionId=await repo.insert(tx,{draft:{...input.content,sortOrder},createdBy:actor,updatedBy:actor})
    }else if(old){
     positionId=old.id
     const values:{draft?:CareerContent;publishedReleaseId?:bigint|null;version:number;updatedBy:bigint}={version:old.version+1,updatedBy:actor}
     if('content' in input)values.draft=input.content
     else{
      if((old.publishedReleaseId?String(old.publishedReleaseId):null)!==input.publishedReleaseId)throw conflictError('STALE','version')
      if(action==='publish'){
       if((await readSiteLanguages(tx)).enabledLocales.some(locale=>!old.draft.localized[locale]?.title))throw new ApiError('INVALID_INPUT',[{path:'content',message:'请先填写启用语言的岗位名称。'}])
       values.publishedReleaseId=await appendCareerRelease(tx,old.id,old.draft,actor)
      }else{
       if(!old.publishedReleaseId)throw conflictError('STALE','version')
       values.publishedReleaseId=null
      }
     }
     await repo.update(tx,old.id,values)
    }else throw new ApiError('NOT_FOUND')
    const next=await repo.get(tx,positionId)
    if(!next)throw new ApiError('NOT_FOUND')
    const value=dto(next.position,next.content??undefined),name=value.content.localized[adminContentLocale]?.title||String(positionId)
    return {id:positionId,name,value,changes:auditChanges('careers',old?{name:old.draft.localized[adminContentLocale]?.title,settingsVersion:old.version}:null,{name,settingsVersion:value.version})}
   })
  },
  async move(actor:bigint,meta:AuthMeta,id:string,raw:unknown){
   const input=await parseInput(careerMoveSchema,raw)
   return auditedWrite(db,{actor,meta,action:'careers.position.move',id,targetType:'careers',isolationLevel:'read committed'},async tx=>{
    await requirePermission(tx,actor,'content.careers.update')
    const rows=(await repo.lockList(tx)).sort((a,b)=>a.draft.sortOrder-b.draft.sortOrder||String(a.id).localeCompare(String(b.id)))
    const index=rows.findIndex(row=>String(row.id)===id),current=rows[index],neighborIndex=index+(input.direction==='up'?-1:1),neighbor=rows[neighborIndex]
    if(!current)throw new ApiError('NOT_FOUND')
    if(current.version!==input.version||!neighbor||String(neighbor.id)!==input.neighborId||neighbor.version!==input.neighborVersion)throw conflictError('STALE','version')
    const changes=current.draft.sortOrder===neighbor.draft.sortOrder?(()=>{
      const ordered=[...rows]
      ;[ordered[index],ordered[neighborIndex]]=[ordered[neighborIndex]!,ordered[index]!]
      return ordered.map((row,index)=>({row,sortOrder:index*10})).filter(change=>change.row.draft.sortOrder!==change.sortOrder)
    })():[{row:current,sortOrder:neighbor.draft.sortOrder},{row:neighbor,sortOrder:current.draft.sortOrder}]
    for(const change of changes){
      if(change.row.version>=4294967295)throw conflictError('STALE','version')
      await repo.update(tx,change.row.id,{draft:{...change.row.draft,sortOrder:change.sortOrder},version:change.row.version+1,updatedBy:actor})
    }
    for(const change of changes.filter(change=>change.row.id!==current.id)){
      await auditService.write(tx,{...meta,actorId:actor,action:'careers.position.move',targetType:'careers',targetId:String(change.row.id),
       targetName:(change.row.draft.localized[adminContentLocale]?.title??'').slice(0,80),result:'success',createdAt:new Date(),
       changeContext:auditChanges('careers',{name:change.row.draft.localized[adminContentLocale]?.title,settingsVersion:change.row.version},
        {name:change.row.draft.localized[adminContentLocale]?.title,settingsVersion:change.row.version+1})})
    }
    const next=await repo.get(tx,current.id)
    if(!next)throw new ApiError('NOT_FOUND')
    const value=dto(next.position,next.content??undefined),name=value.content.localized[adminContentLocale]?.title||String(current.id)
    return {id:current.id,name,value,changes:auditChanges('careers',
      {name:current.draft.localized[adminContentLocale]?.title,settingsVersion:current.version},
      {name,settingsVersion:value.version})}
   })
  },
 }
}
