// 新闻预览编排：组合图片规则、文章投影和布局读取，提供发布页面上下文。
import {computed,toValue,type MaybeRefOrGetter} from 'vue'
import type {NewsContent} from '#shared/schemas/admin/news'
import type {SiteLocale} from '#shared/schemas/admin/site-settings'
import {createNewsApi} from '~/api/admin/news'
import {adminMediaFileUrl} from '~/api/admin/media'
import {useAdminRequestStore} from '~/stores/admin/request'
import {useAdminSessionStore} from '~/stores/admin/session'
import {projectNewsArticlePreview} from '~/utils/admin/preview/news-article'
import {useModuleImageRules} from '~/composables/admin/useModuleImageRules'
import {usePreviewRequest} from '~/composables/admin/usePreviewRequest'
export async function useNewsArticlePreview(content:MaybeRefOrGetter<NewsContent>,locale:MaybeRefOrGetter<SiteLocale>){
 const rules=useModuleImageRules(),session=useAdminSessionStore(),api=createNewsApi(useAdminRequestStore())
 const article=computed(()=>projectNewsArticlePreview(toValue(content),toValue(locale),session.can('content.media.read'),rules.rules.value,adminMediaFileUrl))
 const {data:layout,error:layoutError}=await usePreviewRequest(()=>api.detailLayout(toValue(locale)),'无法读取已发布的新闻详情布局，请确认布局已发布且当前账号有新闻查看权限。')
 return {article,layout,layoutError,ready:rules.ready,error:rules.error,canRead:rules.canRead,retry:rules.retry}
}
