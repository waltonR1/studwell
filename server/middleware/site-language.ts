// 官网语言请求入口：按已发布语言配置处理默认入口和停用语言访问。
import {defineEventHandler,sendRedirect,createError} from 'h3'
import {getDatabase} from '#server/db'
import {supportedLocales,type SupportedLocale} from '#shared/config/site-languages'
import {readSiteLanguages} from '../services/site-languages'

// 在 Nuxt 的默认语言重定向之前处理根入口及停用语言的直达请求。
export default defineEventHandler(async event=>{
 const path=event.path.split('?')[0]??'/'
 const locale=path.split('/')[1] as SupportedLocale
 if(event.method!=='GET'&&event.method!=='HEAD')return
 if(/^\/(?:admin|api|uploads)(?:\/|$)/.test(path))return
 if(path!=='/'&&!supportedLocales.includes(locale)&&!/^\/[a-z][a-z0-9_/-]*$/.test(path))return
 const languages=await getDatabase().transaction(tx=>readSiteLanguages(tx),{isolationLevel:'repeatable read'})
 if(!supportedLocales.includes(locale))return sendRedirect(event,`/${languages.defaultLocale}${path==='/'?'':path}${event.path.includes('?')?'?'+event.path.split('?').slice(1).join('?'):''}`,302)
 if(!languages.enabledLocales.includes(locale))throw createError({statusCode:404,statusMessage:'Page not found'})
})
