// 负责官网模块策略的数据库查询与持久化，使用调用方传入的执行器，不决定 HTTP 响应或业务授权。
import {eq} from 'drizzle-orm'
import type {WebsiteModulePolicy} from '#shared/schemas/website/module-policy'
import type {DatabaseExecutor} from '../db/transaction'
import {websiteModulePolicy} from '../db/schema'
import {websiteModulePolicySchema} from '#shared/schemas/website/module-policy'
import {ApiError} from '../core/errors'
// 不缓存策略，保证调用事务读取同一份数据库状态。
export async function readWebsiteModulePolicy(db:DatabaseExecutor){
 const [row]=await db.select().from(websiteModulePolicy)
 if(!row||row.id!==1)throw new ApiError('INTERNAL_ERROR')
 return {version:row.version,policy:websiteModulePolicySchema.parse(row.policy)}
}

export async function saveWebsiteModulePolicy(db:DatabaseExecutor,policy:WebsiteModulePolicy,version:number){
 await db.update(websiteModulePolicy).set({policy,version:version+1}).where(eq(websiteModulePolicy.id,1))
}
