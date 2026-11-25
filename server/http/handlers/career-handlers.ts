// 适配招聘岗位的 HTTP 请求、输入校验及响应，业务规则交给服务层。
import {getQuery,getRouterParam,setResponseHeader} from 'h3'
import {createCareerService} from '../../services/careers'
import {createAuthService} from '../../services/auth'
import {defineApiHandler} from '../handler'
import {parseInput} from '../../core/validation'
import {parseJsonBody} from '../validation'
import {requestActor,authMeta,type AuthHttpOptions} from '../auth'
import {entityIdSchema} from '#shared/schemas/entity'
import {careerCreateSchema,careerUpdateSchema,careerActionSchema,careerMoveSchema} from '#shared/schemas/admin/careers'
import type {Database} from '../../db/transaction'

export function careerHandler(db:Database,options:AuthHttpOptions,action:'list'|'create'|'update'|'publish'|'withdraw'|'move'){
 const auth=createAuthService(db),service=createCareerService(db)
 return defineApiHandler(async event=>{
  const actor=await requestActor(event,auth)
  setResponseHeader(event,'Cache-Control','private, no-store')
  if(action==='list')return service.list(actor,getQuery(event))
  const id=action==='create'?null:await parseInput(entityIdSchema,getRouterParam(event,'id'))
  if(action==='move')return service.move(actor,authMeta(event,options),id!,await parseJsonBody(event,careerMoveSchema))
  const input=action==='create'?await parseJsonBody(event,careerCreateSchema):action==='update'?await parseJsonBody(event,careerUpdateSchema):await parseJsonBody(event,careerActionSchema)
  return service.mutate(actor,authMeta(event,options),action,id,input)
 })
}
