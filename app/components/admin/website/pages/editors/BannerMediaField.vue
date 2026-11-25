<script setup lang="ts">
import type {SectionFormProps,BannerImagesField} from '~/types/admin/website-section-forms'
import type {LocalizedSections} from '~/types/admin/website-section-editors'
import {valueAt,contentField} from '~/utils/admin/website/section-forms'
import {editBannerImage,editBannerMedia,editImagePresentation} from '~/utils/admin/website/section-editors'
import ImagePresentationButton from '~/components/admin/media/ImagePresentationButton.vue'
import {adminMediaFileUrl} from '~/api/admin/media'
import {useAdminSessionStore} from '~/stores/admin/session'
import type {ImagePresentation} from '#shared/types/image-presentation'
const props=defineProps<SectionFormProps&{field:BannerImagesField}>()
const emit=defineEmits<{replace:[value:LocalizedSections]}>()
const session=useAdminSessionStore()
const topics=computed(()=>valueAt(props.modelValue[props.locale],props.field.path) as Array<Record<string,unknown>>??[])
const index=computed(()=>{
 const matched=topics.value.findIndex(topic=>valueAt(topic,props.field.identityPath)===props.mediaKey)
 return matched>=0?matched:topics.value.length?0:null
})
const image=computed(()=>index.value===null?null:valueAt(topics.value[index.value],props.field.imagePath+'.mediaId') as string|null??null)
const video=computed(()=>valueAt(props.modelValue[props.locale],props.field.videoPath!+'.mediaId') as string|null|undefined)
const imagePath=computed(()=>`${props.field.path}.${index.value??0}.${props.field.imagePath}`)
const preset=computed(()=>contentField(props.definition,imagePath.value)?.imagePreset)
const presentation=computed(()=>index.value===null?undefined:valueAt(topics.value[index.value],props.field.imagePath+'.presentation') as ImagePresentation|undefined)
function changePresentation(value:ImagePresentation){
 if(props.disabled||props.readonly||index.value===null||!preset.value)return
 emit('replace',editImagePresentation(props.modelValue,props.locale,imagePath.value,preset.value,value))
}
function select(selection:{id:string;kind:'image'|'video'}|null){
 if(props.disabled||props.readonly)return
 emit('replace',editBannerMedia(props.modelValue,props.locale,index.value,props.mediaKey??'banner',selection,{...props.field,videoPath:props.field.videoPath!}))
}
function cover(id:string|null){
 if(props.disabled||props.readonly)return
 emit('replace',editBannerImage(props.modelValue,props.locale,index.value,props.mediaKey??'banner',id,props.field))
}
</script>
<template>
 <div class="banner-media-field">
  <AdminMediaPicker :field="`${sectionId}-${locale}-banner-media`" :label="field.label" :model-value="video||image" kind="any" :selected-kind="video?'video':'image'" :disabled="disabled||readonly" @select="select"/>
  <AdminMediaPicker v-if="video" :field="`${sectionId}-${locale}-banner-cover`" label="视频封面（可选）" :model-value="image" kind="image" :disabled="disabled||readonly" @update:model-value="cover"/>
  <ImagePresentationButton v-if="preset&&image&&session.can('content.media.read')" :key="`${locale}-${image}`" :src="adminMediaFileUrl(image)" :preset="preset" :model-value="presentation" :disabled="disabled||readonly" @update:model-value="changePresentation"/>
 </div>
</template>
<style scoped>
.banner-media-field { display: grid; gap: 22px; min-width: 0; }
</style>
