import {getRouterParam} from 'h3'
import {siteModuleUpdateSchema} from '#shared/schemas/website/module-policy'
import type {Database} from '../../db/transaction'
import {createAuthService} from '../../services/auth'
import {readSiteModuleState,updateSiteModuleState} from '../../services/site-module-maintenance'
import {requestActor,authMeta,type AuthHttpOptions} from '../auth'
import {defineApiHandler} from '../handler'
import {parseJsonBody} from '../validation'
export function siteModuleHandler(db:Database,options:AuthHttpOptions,action:'get'|'update'){
 return defineApiHandler(async event=>{
  const actor=await requestActor(event,createAuthService(db)),module=getRouterParam(event,'module')
  if(action==='get')return readSiteModuleState(db,actor,module)
  return updateSiteModuleState(db,actor,module,await parseJsonBody(event,siteModuleUpdateSchema),authMeta(event,options))
 })
}
