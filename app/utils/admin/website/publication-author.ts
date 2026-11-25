// 发布人按账号 ID 区分；状态描述当前账号，不能据此推断发布当时的状态。
import type {PublicationRelease} from '#shared/types/admin/publication-history'
type Author=Pick<PublicationRelease,'createdBy'|'createdByUsername'|'createdByStatus'>
export function publicationAuthorStatus(author:Author){
 return {active:'',disabled:'已停用',deleted:'已删除',unknown:'账号信息缺失'}[author.createdByStatus]
}
export function publicationAuthorLabel(author:Author){
 const name=author.createdByUsername??'未知账号',status=publicationAuthorStatus(author)
 return status?`${name}（${status}）`:name
}
