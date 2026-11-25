// 根据站点发布配置解析页面及其子资源的访问路径。
import {websiteChildPath} from '#shared/utils/website/route'
import {useSiteSettings} from './useSiteSettings'
export function useWebsitePath(){
 const {settings}=useSiteSettings()
 return (key:string,slug?:string)=>{const path=settings.value?.pages[key]?.path;return path?(slug?websiteChildPath(path,slug):path):''}
}
