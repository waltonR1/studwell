// 公开端 GET /api/public/website-route 路由入口，衔接请求处理与业务服务。
import {getQuery} from 'h3'
import {z} from 'zod'
import {getDatabase} from '#server/db'
import {defineApiHandler} from '../../../http/handler'
import {parseInput} from '../../../core/validation'

import {resolvePublicWebsiteRoute} from '../../../services/public-website-route'

const querySchema=z.strictObject({path:z.string().regex(/^\/(?:[a-z][a-z0-9_-]{0,63}(?:\/[a-z][a-z0-9_-]{0,63}){0,5})?$/)})
export default defineApiHandler(async event=>{
 const {path}=await parseInput(querySchema,getQuery(event))
 return resolvePublicWebsiteRoute(getDatabase(), path)
})
