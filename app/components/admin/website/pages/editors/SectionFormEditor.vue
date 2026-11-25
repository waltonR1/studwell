<script setup lang="ts">
import {useAdminNavigationTargetsStore} from '~/stores/admin/navigation-targets'
import type {MediaSelection} from '#shared/types/image-presentation'
import SectionFormFields from './SectionFormFields.vue'
import type {SectionFormProps,ValueField,CollectionField,BannerImagesField,ListAction} from '~/types/admin/website-section-forms'
import type {LocalizedSections} from '~/types/admin/website-section-editors'
import {editBannerImage} from '~/utils/admin/website/section-editors'
import {changeFormValue,changeFormList,fieldPath,sectionFormLinkErrors} from '~/utils/admin/website/section-forms'
const props=defineProps<SectionFormProps>()
// 同一表单的递归字段共享查询；退出表单时释放，不跟随页面草稿生命周期。
const navigationTargets=useAdminNavigationTargetsStore()
onBeforeUnmount(navigationTargets.reset)
const emit=defineEmits<{'update:modelValue':[value:LocalizedSections];'update:media':[key:string,value:MediaSelection];validation:[message:string]}>()
const isTableGroup=(group:SectionFormProps['config']['groups'][number])=>group.fields.length===1&&group.fields[0]?.kind==='collection'&&group.fields[0].presentation==='table'
const errors=ref<Record<string,string>>({})
const dialogMessages=ref<Record<string,string>>({})
const pageMessage=computed(()=>[...Object.values(errors.value),...sectionFormLinkErrors(props.modelValue,props.config)].join(' '))
const message=computed(()=>[pageMessage.value,...Object.values(dialogMessages.value)].filter(Boolean).join(' '))
watch(message,value=>emit('validation',value),{immediate:true})
watch(()=>props.locale,()=>{errors.value={}})
function apply(key:string,operation:()=>LocalizedSections){
 if(props.disabled||props.readonly)return
 try{const next=operation();delete errors.value[key];emit('validation',message.value);emit('update:modelValue',next)}
 catch(cause){errors.value[key]=cause instanceof Error?cause.message:'请检查当前内容。';emit('validation',message.value)}
}
function change(field:ValueField,base:string,value:unknown){
 const path=fieldPath(field,base),listPath=base.split('.').slice(0,-1).join('.')
 const collection=props.config.groups.flatMap(group=>group.fields).find((field):field is CollectionField=>field.kind==='collection'&&field.path===listPath)
 apply(path,()=>changeFormValue(props.modelValue,props.locale,field,base,value,collection?.identity))
}
async function list(field:CollectionField|ValueField,base:string,index:number,action:ListAction){
 if(props.disabled||props.readonly)return
 const path=field.kind==='collection'?field.path:fieldPath(field,base)
 if(action==='remove'&&props.confirmRemove&&!await props.confirmRemove(field.kind==='collection'?'此条目会从各语言中一并移除，保存区块草稿后生效。':'只移除当前语言的这一条内容，保存区块草稿后生效。'))return
 apply(path,()=>{
  const next=changeFormList(props.modelValue,props.locale,props.definition,field,base,index,action)
  for(const key of Object.keys(errors.value))if(key.startsWith(path+'.'))delete errors.value[key]
  return next
 })
}
function replace(value:LocalizedSections){if(!props.disabled&&!props.readonly)emit('update:modelValue',value)}
function validation(path:string,message:string,inDialog=false){
 const messages=inDialog?dialogMessages.value:errors.value
 if(message)messages[path]=message;else delete messages[path]
}
function media(key:string,value:MediaSelection){if(!props.disabled&&!props.readonly)emit('update:media',key,value)}
function banner(field:BannerImagesField,index:number|null,value:string|null){
 apply(field.path,()=>editBannerImage(props.modelValue,props.locale,index,props.mediaKey??'banner',value,field))
}
</script>
<template>
 <div class="section-editor-panels">
  <AdminCommonFeedback v-if="pageMessage" tone="error">{{ pageMessage }}</AdminCommonFeedback>
  <section v-for="group in config.groups" :key="group.title" :class="isTableGroup(group)?undefined:'section-editor-panel'"><h3 v-if="!isTableGroup(group)">{{ group.title }}</h3><p v-if="group.help&&!isTableGroup(group)" class="admin-help">{{ group.help }}</p>
   <SectionFormFields :fields="group.fields" :list-title="isTableGroup(group)?group.title:undefined" :list-description="isTableGroup(group)?group.help:undefined" :model-value="modelValue" :locale="locale" :definition="definition" :shared="shared" :config="config" :section-id="sectionId" :media-key="mediaKey" :banner-name="bannerName" :disabled="disabled" :readonly="readonly" @change="change" @list="list" @media="media" @banner="banner" @replace="replace" @validation="validation"/>
  </section>
 </div>
</template>
<style>
.admin-shell[data-admin-shell] .section-editor-panels { display: grid; gap: 28px; }
.admin-shell[data-admin-shell] .section-editor-panel { display: grid; gap: 20px; min-width: 0; padding: 24px; border: 1px solid #e1e8f1; border-radius: 10px; background: #fff; }
.admin-shell[data-admin-shell] .section-editor-panel > .admin-help { margin: 0; }
.admin-shell[data-admin-shell] .section-editor-field { display: grid; gap: 10px; min-width: 0; }
@media(max-width:720px){.admin-shell[data-admin-shell] .section-editor-panel { padding: 18px; }}
</style>
