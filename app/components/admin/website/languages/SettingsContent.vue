<script setup lang="ts">
import {supportedLocales,type SupportedLocale} from '#shared/config/site-languages'
import {siteLocaleNames} from '#shared/config/admin/site-settings'
import type {LanguageMaintenanceContent} from '~/types/admin/website-maintenance'
const props=defineProps<LanguageMaintenanceContent>()
const {record,form,busy}=props
const publishedNames=computed(()=>record.value?.publishedLanguages.enabledLocales.map(locale=>siteLocaleNames[locale]).join('、')??'')
const defaultName=computed(()=>record.value?siteLocaleNames[record.value.publishedLanguages.defaultLocale]:'')
const options=computed(()=>form.value.enabledLocales.map(value=>({value,label:siteLocaleNames[value]})))
function enable(locale:SupportedLocale,value:boolean){form.value.enabledLocales=value?[...form.value.enabledLocales,locale]:form.value.enabledLocales.filter(key=>key!==locale)}
</script>
<template>
 <section class="admin-section site-card">
  <h3>语言设置</h3>
  <p v-if="record" class="admin-help">当前公开：{{ publishedNames }}；默认：{{ defaultName }}。</p>
  <div class="admin-fields admin-view-profile-form">
   <div class="admin-view-full-width">
    <p id="site-language-options-label" class="admin-view-field-label">启用语言</p>
    <div class="site-fields" role="group" aria-labelledby="site-language-options-label">
     <AdminCommonSwitchField v-for="locale in supportedLocales" :key="locale" :label="siteLocaleNames[locale]" layout="row" :disabled="busy" :model-value="form.enabledLocales.includes(locale)" @update:model-value="enable(locale,$event)"/>
    </div>
   </div>
   <label>默认语言<AdminCommonSelectField v-model="form.defaultLocale" label="默认语言" :disabled="busy" :items="options"/><span class="admin-help">默认语言必须包含在启用语言中。</span></label>
   <p class="admin-view-full-width admin-help">保存草稿后需发布才会生效。启用新语言前，请先发布对应正文及 SEO；停用语言不会删除内容。</p>
  </div>
 </section>
</template>
