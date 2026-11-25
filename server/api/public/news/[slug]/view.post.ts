// 公开端 POST /api/public/news/[slug]/view 路由入口，衔接请求处理与业务服务。
import {getHeader,getRouterParam} from 'h3'
import {getDatabase} from '#server/db'
import {ApiError} from '../../../../core/errors'
import {defineApiHandler} from '../../../../http/handler'
import {createPublicNewsService} from '../../../../services/public-news'

export default defineApiHandler(async event=>{
  const site=getHeader(event,'sec-fetch-site')
  if(site&&site!=='same-origin'&&site!=='none')throw new ApiError('FORBIDDEN')
  return createPublicNewsService(getDatabase()).recordView(getRouterParam(event,'slug'))
})
