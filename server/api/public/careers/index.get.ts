// 公开端 GET /api/public/careers 路由入口，衔接请求处理与业务服务。
import {getQuery,setResponseHeader} from 'h3'
import {getDatabase} from '#server/db'
import {defineApiHandler} from '../../../http/handler'
import {createPublicCareerService} from '../../../services/public-careers'

export default defineApiHandler(async event=>{
 setResponseHeader(event,'Cache-Control','no-store')
 return createPublicCareerService(getDatabase()).list(getQuery(event))
})
