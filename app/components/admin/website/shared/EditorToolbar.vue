<script setup lang="ts">
import type {SiteLocale} from '#shared/schemas/admin/site-settings'
import ContentLanguageSelect from './ContentLanguageSelect.vue'

defineProps<{ dirty: boolean; status?: string; locale?: SiteLocale; disabled?: boolean }>()
const emit = defineEmits<{ 'update:locale': [value: SiteLocale] }>()
</script>
<template>
  <div class="site-settings-toolbar">
    <div class="site-settings-status">
      <AdminCommonDraftBadge :dirty="dirty"/>
      <span v-if="status">{{ status }}</span></div>
    <div v-if="locale || $slots.actions" class="site-language-control">
      <template v-if="locale">
        <span aria-hidden="true">内容语言</span>
        <ContentLanguageSelect :model-value="locale" :disabled="disabled"
                                @update:model-value="emit('update:locale',$event as SiteLocale)"/>
      </template>
      <slot name="actions"/>
    </div>
  </div>
</template>
<style scoped>
.site-settings-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 24px
}

.site-settings-status, .site-language-control {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  color: var(--admin-view-muted);
  font-size: 13px
}

.site-language-control {
  margin-left: auto;
  gap: 12px
}
</style>
