import {supportedLocales,type SupportedLocale} from '#shared/config/site-languages'
import {useSiteLanguages} from '~/composables/public/runtime/useSiteLanguages'

export default defineNuxtRouteMiddleware(async to=>{
 if(/^\/admin(?:\/|$)/.test(to.path))return
 // 每次导航读取一次当前公开范围，包含首次客户端进入和后续站内跳转。
 const {languages,ready}=useSiteLanguages()
 await ready
 const settings=languages.value
 if(!settings)throw createError({statusCode:503,statusMessage:'Site languages are unavailable'})
 const prefix=to.path.split('/')[1] as SupportedLocale
 if(supportedLocales.includes(prefix)){
  if(!settings.enabledLocales.includes(prefix))throw createError({statusCode:404,statusMessage:'Page not found'})
 }else{
  return navigateTo({path:`/${settings.defaultLocale}${to.path==='/'?'':to.path}`,query:to.query,hash:to.hash},{redirectCode:302})
 }
})
