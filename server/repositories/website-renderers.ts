// 读取数据库登记的公开与预览组件路径。
import {and,eq} from 'drizzle-orm'
import {websiteRenderers} from '../db/schema'
import type {DatabaseExecutor} from '../db/transaction'

export function readWebsiteRenderers(db: DatabaseExecutor, scope: 'public' | 'preview') {
    return db.select({key: websiteRenderers.key, path: websiteRenderers.componentPath})
        .from(websiteRenderers).where(eq(websiteRenderers.scope, scope))
}
export async function insertWebsiteRenderers(db:DatabaseExecutor,key:string,publicPath:string,previewPath:string){
 await db.insert(websiteRenderers).values([{scope:'public',key,componentPath:publicPath},{scope:'preview',key,componentPath:previewPath}])
}
export const removeWebsiteRenderer=(db:DatabaseExecutor,scope:'public'|'preview',key:string)=>db.delete(websiteRenderers).where(and(eq(websiteRenderers.scope,scope),eq(websiteRenderers.key,key)))
