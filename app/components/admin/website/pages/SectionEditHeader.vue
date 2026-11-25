<script setup lang="ts">
import type {SiteLocale} from '#shared/schemas/admin/site-settings'
import ContentLanguageSelect from '../shared/ContentLanguageSelect.vue'
const locale=defineModel<SiteLocale>('locale',{required:true})
defineProps<{backTo:string;backLabel:string;title:string;description:string;ready:boolean;dirty:boolean;busy:boolean;saving:boolean;canEdit:boolean;saveEnabled:boolean;saveLabel:string}>()
const emit=defineEmits<{save:[]}>()
</script>
<template>
 <header class="section-edit-header">
  <div class="section-edit-navigation">
   <AdminCommonBackLink :to="backTo">{{ backLabel }}</AdminCommonBackLink>
   <AdminCommonDraftBadge v-if="ready" :dirty="dirty"/>
  </div>
  <div class="section-edit-heading">
   <div class="section-edit-title"><h1>{{ title }}</h1><p>{{ description }}</p></div>
   <div class="section-edit-actions">
    <slot name="actions" />
    <div v-if="ready" class="section-edit-language"><span aria-hidden="true">内容语言</span><ContentLanguageSelect v-model="locale" :disabled="busy"/></div>
    <UButton v-if="canEdit" class="admin-button admin-button-primary" :disabled="busy||!saveEnabled" @click="emit('save')">{{ saving?'保存中…':saveLabel }}</UButton>
   </div>
  </div>
 </header>
</template>

<style scoped>
.section-edit-header { display: grid; gap: 18px; padding: 20px 24px; margin-bottom: 24px; background: #fff; border: 1px solid var(--admin-view-line); border-radius: 12px; }
.section-edit-navigation { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.section-edit-navigation :deep(.admin-back-link) { min-height: 28px; padding: 2px 0; margin: 0; border-color: transparent; background: transparent; }
.section-edit-heading { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.section-edit-title { min-width: 0; }
.section-edit-title h1 { margin: 0; font-size: 24px; line-height: 1.4; overflow-wrap: anywhere; }
.section-edit-title p { margin: 6px 0 0; color: var(--admin-view-muted); font-size: 13px; line-height: 1.7; }
.section-edit-actions { display: flex; align-items: center; flex-shrink: 0; gap: 20px; }
.section-edit-language { display: flex; align-items: center; gap: 10px; color: var(--admin-view-muted); font-size: 13px; white-space: nowrap; }
.section-edit-language :deep(.admin-select-field) { min-width: 104px; }
@media (max-width: 900px) {
 .section-edit-heading { align-items: flex-start; flex-direction: column; gap: 18px; }
 .section-edit-actions { width: 100%; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
}
@media (max-width: 600px) {
 .section-edit-header { padding: 16px; gap: 14px; }
 .section-edit-title h1 { font-size: 21px; }
}
</style>
