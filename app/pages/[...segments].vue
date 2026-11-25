<script setup lang="ts">
import ContentPage from '~/components/public/runtime/routes/ContentPage.vue'
import {useSiteSettings} from '~/composables/public/runtime/useSiteSettings'
import {usePublicWebsiteRouteApi} from '~/api/public/website-route'
import {detailTemplates,sectionBehaviors} from '~/composables/public/sections/pageExtensions'
definePageMeta({key: route => route.path})
const route=useRoute()
const localePath=useLocalePath()
const {locales}=useI18n()
const origin=useRequestURL().origin
const segments=Array.isArray(route.params.segments)?route.params.segments:[String(route.params.segments??'')]
if(segments.length>6||segments.some(segment=>!/^[a-z][a-z0-9_-]{0,63}$/.test(segment)))throw createError({statusCode:404,statusMessage:'Page not found'})
const path='/'+segments.join('/')
const bootstrap=useSiteSettings()
await bootstrap.ready
const request=await usePublicWebsiteRouteApi(path)
const {error}=request
const targetResponse=()=>request.data.value?.success?request.data.value.data:undefined
for(let attempt=0;attempt<2&&(targetResponse()?.configReleaseId!==bootstrap.settings.value?.configReleaseId||targetResponse()?.languageReleaseId!==bootstrap.settings.value?.languageReleaseId);attempt++)await Promise.all([request.refresh(),bootstrap.refresh()])
if(!error.value&&(targetResponse()?.configReleaseId!==bootstrap.settings.value?.configReleaseId||targetResponse()?.languageReleaseId!==bootstrap.settings.value?.languageReleaseId))throw createError({statusCode:503,statusMessage:'Site configuration is changing. Please retry.'})
if(error.value)throw createError(error.value)
const target=targetResponse()
if(!target)throw createError({statusCode:404,statusMessage:'Page not found'})
useHead(()=>({link:[
 {rel:'canonical',href:origin+localePath(target.path)},
 ...locales.value.filter(language=>bootstrap.settings.value?.languages.enabledLocales.includes(language.code)??false).map(language=>({rel:'alternate' as const,hreflang:language.language??language.code,href:origin+localePath(target.path,language.code)})),
]}))
</script>

<template>
 <ContentPage :detail-templates="detailTemplates" :section-behaviors="sectionBehaviors" :target-type="target.targetType" :page-key="target.pageKey" :target-key="target.targetType === 'page' ? '' : target.targetKey" />
</template>
