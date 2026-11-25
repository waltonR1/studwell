// 独立语言草稿与发布接口；不持有草稿、确认框或通知状态。
import type {z} from 'zod'
import type {siteLanguageSaveSchema,siteLanguagePublishSchema} from '#shared/schemas/admin/site-languages'
import type {SiteLanguageState} from '#shared/types/admin/site-languages'
import type {AdminApiClient} from '~/types/admin/api'
export function createSiteLanguagesApi(api:AdminApiClient){return {
 read:()=>api.read<SiteLanguageState>('site-languages'),
 save:(body:z.infer<typeof siteLanguageSaveSchema>)=>api.mutate<SiteLanguageState>('site-languages','PUT',body),
 publish:(body:z.infer<typeof siteLanguagePublishSchema>)=>api.mutate('site-languages/publish','POST',body),
}}
