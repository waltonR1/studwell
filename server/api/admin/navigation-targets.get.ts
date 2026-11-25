// 管理端 GET /api/admin/navigation-targets 路由入口，衔接请求处理与业务服务。
import {defineEventHandler, getQuery} from 'h3'
import {z} from 'zod'
import {getDatabase} from '#server/db'
import {defineApiHandler} from '../../http/handler'
import {requestActor} from '../../http/auth'
import {createAuthService} from '../../services/auth'
import {getPermissionSnapshot} from '../../services/access/permissions'
import {websiteNavigationTargets} from '../../services/website-navigation-targets'
import {parseInput} from '../../core/validation'
import {ApiError} from '../../core/errors'

export default defineEventHandler(defineApiHandler(async event => {
 const db=getDatabase()
 const actor=await requestActor(event,createAuthService(db))
 await parseInput(z.strictObject({}),getQuery(event))
 const access=await getPermissionSnapshot(db,actor)
 if (!access.isRoot && !access.permissions.some(permission => ['content.pages.read','content.site_settings.read'].includes(permission))) throw new ApiError('FORBIDDEN')
 return db.transaction(tx => websiteNavigationTargets(tx),{isolationLevel:'repeatable read'})
}))
