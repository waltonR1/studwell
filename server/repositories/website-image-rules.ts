// 负责模块图片规则的数据库查询与持久化，使用调用方传入的执行器，不决定 HTTP 响应或业务授权。
import {websiteImageRules} from '../db/schema'
import type {DatabaseExecutor} from '../db/transaction'
import {moduleImageRulesSchema} from '#shared/schemas/admin/image-rules'
export async function readModuleImageRules(db:DatabaseExecutor){
 const [row]=await db.select().from(websiteImageRules)
 if(!row||row.id!==1)throw new Error('WEBSITE_IMAGE_RULES_MIGRATION_REQUIRED')
 return moduleImageRulesSchema.parse(row.rules)
}
