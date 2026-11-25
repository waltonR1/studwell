// 咨询预览适配：提供样例分类及局部表单输入，提交为空操作。
import {computed,provide,reactive,ref,toValue,type MaybeRefOrGetter} from 'vue'
import type {WebsitePreviewData} from '#shared/types/admin/website-preview'
import {inquiryFormSource} from '~/composables/public/sections/contact/useInquiryForm'
export function provideInquiriesPreview(source:MaybeRefOrGetter<Pick<WebsitePreviewData,'inquiryCategories'>>){
 const sample=computed(()=>toValue(source))
 provide(inquiryFormSource,async()=>({
  fields:reactive({category:'',name:'',email:'',company:'',country:'',message:''}),
  categories:computed(()=>sample.value.inquiryCategories??[]),categoryStatus:ref('success' as const),invalidEmail:ref(false),pending:ref(false),reference:ref(''),error:ref('' as const),submit:async()=>{},
 }))
}
