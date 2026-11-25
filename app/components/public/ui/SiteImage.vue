<!-- 不增加容器；统一应用模板允许的取景、缩放和效果，未配置的图片沿用原样式。 -->
<script setup lang="ts">
import type { DisplayImage } from '~/types/public/runtime/media'
import { resolveContentLocale } from '~/utils/public/runtime/locale'
import type {ImageRule,ImagePresentation} from '#shared/types/image-presentation'
import {containImageOffset,resolveImagePresentation} from '#shared/utils/image-presentation'
const props = defineProps<{
  image: DisplayImage
  optimized?: boolean
  alt?: string
  width?: string | number
  height?: string | number
  imagePreset?:ImageRule
  presentation?:ImagePresentation
}>()
const { locale } = useI18n()
const description = computed(() => props.alt ?? (typeof props.image.alt === 'string' ? props.image.alt : props.image.alt[resolveContentLocale(locale.value)]))
const preset=computed(()=>props.imagePreset??props.image.imagePreset)
const settings=computed(()=>preset.value?resolveImagePresentation(preset.value,props.presentation??props.image.presentation):null)
const presentationStyle=computed(()=>{
 const value=settings.value
 if(!value)return undefined
 const rule=preset.value!
 const fit='fit'in rule?rule.fit:'cover'
 if(rule.fit==='contain')return {'--image-desktop-zoom':value.desktop.zoom,'--image-mobile-zoom':value.mobile.zoom,
  '--image-desktop-offset':containImageOffset(value.desktop),'--image-mobile-offset':containImageOffset(value.mobile),
  objectFit:fit,objectPosition:'center',transformOrigin:'center',translate:'var(--image-offset)',scale:'var(--image-zoom)',opacity:value.opacity,
  filter:`brightness(${value.brightness}) var(--image-extra-filter, brightness(1))`}
 return {'--image-desktop-position':`${value.desktop.x}% ${value.desktop.y}%`,'--image-mobile-position':`${value.mobile.x}% ${value.mobile.y}%`,'--image-desktop-zoom':value.desktop.zoom,'--image-mobile-zoom':value.mobile.zoom,objectFit:fit as 'cover'|'contain',objectPosition:'var(--image-position)',scale:'var(--image-zoom)',transformOrigin:'var(--image-position)',opacity:value.opacity,filter:`brightness(${value.brightness}) var(--image-extra-filter, brightness(1))`}
})
const presentationAttrs=computed(()=>settings.value?{class:'site-image-presented',style:presentationStyle.value}:{})
</script>

<template>
  <NuxtImg v-if="optimized" :src="image.src" :alt="description" :width="width ?? image.width" :height="height ?? image.height" :srcset="image.srcSet" v-bind="presentationAttrs" />
  <img v-else :src="image.src" :alt="description" :width="width ?? image.width" :height="height ?? image.height" :srcset="image.srcSet" v-bind="presentationAttrs">
</template>

<style scoped>
.site-image-presented { --image-position:var(--image-desktop-position); --image-zoom:var(--image-desktop-zoom); --image-offset:var(--image-desktop-offset); }
@media(max-width:767px) { .site-image-presented { --image-position:var(--image-mobile-position); --image-zoom:var(--image-mobile-zoom); --image-offset:var(--image-mobile-offset); } }
</style>
