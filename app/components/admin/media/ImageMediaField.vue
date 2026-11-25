<script setup lang="ts">
import type {ImageReference,ImageRule} from '#shared/types/image-presentation'
import {adminMediaFileUrl} from '~/api/admin/media'
import {useAdminSessionStore} from '~/stores/admin/session'
import ImagePresentationButton from './ImagePresentationButton.vue'
const props=defineProps<{field:string;label:string;modelValue:ImageReference;imagePreset?:ImageRule;disabled?:boolean}>()
const emit=defineEmits<{'update:modelValue':[value:ImageReference]}>()
const session=useAdminSessionStore()
function image(mediaId:string|null){if(!props.disabled)emit('update:modelValue',mediaId===props.modelValue.mediaId?props.modelValue:{mediaId})}
</script>
<template>
 <div class="image-media-field">
  <AdminMediaPicker :field="field" :label="label" :model-value="modelValue.mediaId" kind="image" :disabled="disabled" @update:model-value="image"/>
  <ImagePresentationButton v-if="imagePreset&&modelValue.mediaId&&session.can('content.media.read')" :key="modelValue.mediaId" :src="adminMediaFileUrl(modelValue.mediaId)" :preset="imagePreset" :model-value="modelValue.presentation" :disabled="disabled" @update:model-value="!disabled&&emit('update:modelValue',{...modelValue,presentation:$event})"/>
 </div>
</template>
<style scoped>
.image-media-field { display:grid; gap:20px; min-width:0; }
</style>
