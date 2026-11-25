// 批量投影发布元数据与用户名，不要求调用方额外拥有账号管理权限。
import type {DatabaseExecutor} from '../db/transaction'
import type {PublicationRelease} from '#shared/types/admin/publication-history'
import {accountRepository} from '../repositories/accounts'

export async function publicationMetadata(db:DatabaseExecutor,rows:readonly {id:bigint;createdAt:Date;createdBy:bigint;restoredFrom:bigint|null}[]):Promise<PublicationRelease[]>{
 const authors=new Map((await accountRepository.identities(db,rows.map(row=>row.createdBy))).map(row=>[row.id,row]))
 return rows.map(row=>{
  const author=authors.get(row.createdBy)
  const createdByStatus:PublicationRelease['createdByStatus']=!author?'unknown':author.deletedAt?'deleted':!author.enabled?'disabled':'active'
  return {id:String(row.id),createdAt:row.createdAt.toISOString(),createdBy:String(row.createdBy),createdByUsername:author?.username??null,createdByStatus,restoredFrom:row.restoredFrom===null?null:String(row.restoredFrom)}
 })
}
