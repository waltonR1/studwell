<script setup lang="ts">
import type {ImagePresentation,ImageRule} from '#shared/types/image-presentation'
import ImagePresentationEditor from './ImagePresentationEditor.vue'
const props=defineProps<{src:string;preset:ImageRule;modelValue?:ImagePresentation;disabled?:boolean}>()
const emit=defineEmits<{'update:modelValue':[value:ImagePresentation]}>()
const open=ref(false),draft=ref<ImagePresentation>()
function edit(){
 if(props.disabled)return
 draft.value=props.modelValue?JSON.parse(JSON.stringify(props.modelValue)) as ImagePresentation:undefined
 open.value=true
}
function close(){open.value=false;draft.value=undefined}
function apply(){
 if(props.disabled)return
 const value=draft.value
 close()
 if(value&&JSON.stringify(value)!==JSON.stringify(props.modelValue))emit('update:modelValue',JSON.parse(JSON.stringify(value)) as ImagePresentation)
}
watch(()=>[props.src,props.preset,props.disabled,props.modelValue],close,{deep:true})
</script>
<template>
 <div class="image-presentation-button">
  <UButton type="button" class="admin-button" :disabled="disabled" @click="edit">调整图片</UButton>
  <Teleport v-if="open" to="#admin-main-content" defer>
   <div class="admin-module admin-view-page image-adjust-dialog">
    <AdminCommonDialog :open="open" title="调整图片" description="拖动、缩放并预览效果，确认后应用到当前表单；保存表单后生效。" size="large" @close="close">
     <ImagePresentationEditor v-model="draft" :src="src" :preset="preset" :disabled="disabled"/>
     <template #actions>
      <UButton type="button" class="admin-button" @click="close">取消</UButton>
      <UButton type="button" class="admin-button admin-button-primary" :disabled="disabled" @click="apply">应用调整</UButton>
     </template>
    </AdminCommonDialog>
   </div>
  </Teleport>
 </div>
</template>
<style scoped>
.image-adjust-dialog { display:contents; }
.image-adjust-dialog :deep(.admin-dialog) { z-index:71; }
.image-adjust-dialog :deep(.admin-overlay) { z-index:70; }
</style>
