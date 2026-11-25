// 后台预览装配入口：组合站点上下文与各业务提供器，具体样例适配归对应业务文件。
import {provide,type MaybeRefOrGetter} from 'vue'
import type {WebsitePreviewData} from '#shared/types/admin/website-preview'
import type {PublicSiteSettings} from '#shared/types/public/website'
import {sampleSiteSettingsKey} from '~/composables/public/runtime/useSiteSettings'
import {provideNewsPreview} from './news'
import {provideCareersPreview} from './careers'
import {provideInquiriesPreview} from './inquiries'
export function providePreviewData(source:MaybeRefOrGetter<WebsitePreviewData>,settings?:PublicSiteSettings){
 if(settings)provide(sampleSiteSettingsKey,settings)
 provideNewsPreview(source,settings)
 provideCareersPreview(source)
 provideInquiriesPreview(source)
}
