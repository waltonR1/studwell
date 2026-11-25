// 发布历史共用元数据：ID 用于关联，用户名用于展示，不暴露账号其他资料。
export interface PublicationRelease {
 id:string
 createdAt:string
 createdBy:string
 createdByUsername:string|null
 createdByStatus:'active'|'disabled'|'deleted'|'unknown'
 restoredFrom:string|null
}
