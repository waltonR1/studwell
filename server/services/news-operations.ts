// 读取和保存新闻模块运行设置，不操作文章正文。
import {newsOperationsUpdateSchema} from '#shared/schemas/admin/news'
import type {Database,DatabaseExecutor} from '../db/transaction'
import type {AuthMeta} from '../core/auth-context'
import {conflictError} from '../core/errors'
import {parseInput} from '../core/validation'
import {auditChanges} from '../policies/audit-changes'
import {newsOperationsRepository as repo} from '../repositories/news-operations'
import {requirePermission} from './access/permissions'
import {auditedWrite} from './operations/audited-write'

export async function readNewsOperations(db:DatabaseExecutor){
  const row=await repo.get(db)
  if(!row)throw new Error('NEWS_OPERATIONS_MIGRATION_REQUIRED')
  return row
}

export function saveNewsOperations(db:Database,actor:bigint,raw:unknown,meta:AuthMeta){
  return auditedWrite(db,{actor,meta,action:'news.operations.update',id:null,targetType:'news',targetName:'新闻运营设置'},async tx=>{
    await requirePermission(tx,actor,'content.news.operations.update')
    const input=await parseInput(newsOperationsUpdateSchema,raw)
    const before=await readNewsOperations(tx)
    if(!await repo.update(tx,input.viewCountEnabled,input.version))throw conflictError('STALE','version')
    const value={viewCountEnabled:input.viewCountEnabled,version:input.version+1}
    return {id:1n,name:'新闻运营设置',value,changes:auditChanges('news',
      {settingsFields:before.viewCountEnabled?'浏览量开启':'浏览量关闭'},
      {settingsFields:value.viewCountEnabled?'浏览量开启':'浏览量关闭'})}
  })
}
