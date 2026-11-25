// 读取站点语言配置，管理公开端的默认语言和可用语言。
import {usePublicSiteLanguagesApi} from '~/api/public/site-languages'

export function useSiteLanguages(){
 const request=usePublicSiteLanguagesApi({key:'public-site-languages',dedupe:'defer',immediate:false})
 const languages=computed(()=>request.data.value?.success?request.data.value.data:undefined)
 const ready=request.execute().then(()=>{
  if(request.error.value)throw createError(request.error.value)
  if(!languages.value)throw createError({statusCode:503,statusMessage:'Site languages are unavailable'})
 })
 void ready.catch(()=>{})
 return {languages,ready}
}
