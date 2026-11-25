// 招聘预览适配：仅提供样例岗位，不触发公开招聘请求。
import {computed,provide,ref,toValue,type MaybeRefOrGetter} from 'vue'
import type {WebsitePreviewData} from '#shared/types/admin/website-preview'
import {careerPositionsSource} from '~/composables/public/sections/careers/useCareerPositions'
export function provideCareersPreview(source:MaybeRefOrGetter<Pick<WebsitePreviewData,'positions'>>){
 const sample=computed(()=>toValue(source))
 provide(careerPositionsSource,async()=>({positions:computed(()=>sample.value.positions??[]),available:computed(()=>true),error:ref(),pending:ref(false)}))
}
