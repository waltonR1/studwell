<script setup lang="ts">
import {siteLocales,type SiteLocale} from '#shared/schemas/admin/site-settings'
import {siteLocaleNames} from '#shared/config/admin/site-settings'
import {useSiteLanguages} from '~/composables/public/runtime/useSiteLanguages'
const locale=defineModel<SiteLocale>({required:true})
defineProps<{disabled?:boolean}>()
const prepare=ref(false)
// 已发布语言是公开配置；普通内容编辑者无需站点语言管理权限。
const {languages:data,ready}=useSiteLanguages()
await ready
const options=computed(()=>siteLocales.filter(value=>prepare.value||data.value?.enabledLocales.includes(value)).map(value=>({value,label:siteLocaleNames[value]+(data.value?.enabledLocales.includes(value)?'':'（未启用）')})))
watch(data,()=>{
 if(data.value&&!data.value.enabledLocales.includes(locale.value))locale.value=data.value.defaultLocale
},{immediate:true})
</script>
<template>
 <div class="content-language-select">
  <AdminCommonSelectField v-model="locale" :items="options" label="内容语言" wide-menu commit-focused-field :disabled="disabled">
   <template v-if="data&&data.enabledLocales.length<siteLocales.length" #content-bottom>
    <button type="button" class="content-language-prepare" :aria-expanded="prepare" @click.stop="prepare=!prepare">{{ prepare?'仅已启用语言':'准备其他语言' }}</button>
   </template>
  </AdminCommonSelectField>
 </div>
</template>
<style scoped>
.content-language-select{display:flex;align-items:center;gap:8px}
.content-language-prepare{display:block;width:100%;padding:10px 12px;border:0;border-top:1px solid #edf0f5;background:#fff;color:#738198;text-align:left;font:inherit;font-size:13px;cursor:pointer}
.content-language-prepare:hover{background:#f0f5fb;color:#235a93}
.content-language-prepare:focus-visible{outline:2px solid #235a93;outline-offset:-3px}
</style>
