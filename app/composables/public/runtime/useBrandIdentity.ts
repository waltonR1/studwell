// 读取站点配置中的品牌名称，供官网标识和页面信息使用。
import {useSiteSettings} from './useSiteSettings'
export function useBrandIdentity(){const {settings}=useSiteSettings();return computed(()=>settings.value?.footer?.copyrightHolder??'')}
