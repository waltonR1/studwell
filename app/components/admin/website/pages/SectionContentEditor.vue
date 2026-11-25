<script setup lang="ts">
import type {MediaSelection} from '#shared/types/image-presentation'
import type {WebsiteSectionRecord} from '#shared/types/admin/website'
import type {SiteLocale} from '#shared/schemas/admin/site-settings'
import SectionFormEditor from './editors/SectionFormEditor.vue'
import {resolveSectionForm} from '~/utils/admin/website/section-form-definition'
const props=defineProps<{section:WebsiteSectionRecord;locale:SiteLocale;disabled?:boolean;readonly?:boolean;bannerName?:string;confirmRemove?:(message?:string)=>Promise<boolean>}>()
const emit=defineEmits<{'update:localized':[value:WebsiteSectionRecord['localized']];'update:media':[key:string,value:MediaSelection];validation:[message:string]}>()
const form=computed(()=>props.section.definition?resolveSectionForm(props.section.definition):undefined)
const baseline=ref(0)
watch(()=>props.section,()=>{baseline.value++;emit('validation','')})
watch(()=>props.section.templateKey,()=>emit('validation',''))

</script>
<template>
 <SectionFormEditor v-if="form&&section.definition" :key="section.id+section.templateKey+baseline" :config="form" :definition="section.definition" :shared="section.shared" :model-value="section.localized" :locale="locale" :disabled="disabled||readonly" :readonly="readonly" :section-id="section.id" :media-key="'banner'" :banner-name="bannerName" :confirm-remove="confirmRemove" @update:model-value="emit('update:localized',$event)" @update:media="(key,value)=>emit('update:media',key,value)" @validation="emit('validation',$event)"/>
 <AdminCommonFeedback v-else tone="warning">当前区块缺少字段定义，请检查模板修订。</AdminCommonFeedback>
</template>
