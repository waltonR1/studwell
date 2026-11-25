<script setup lang="ts">
import type {SiteLink, SiteLocale} from '#shared/schemas/admin/site-settings'
import type {SiteTarget} from '#shared/types/admin/site-settings'
import {siteLocaleNames} from '#shared/config/admin/site-settings'
import LinkTargetSelect from '~/components/admin/website/shared/LinkTargetSelect.vue'

defineProps<{ locale: SiteLocale; targets: SiteTarget[] }>()
const link = defineModel<SiteLink>('link', {required: true})
</script>
<template>
  <div class="site-edit-fields">
    <div class="site-field"><span>链接目标</span>
      <LinkTargetSelect :model-value="link.target" @update:model-value="value=>{if(value)link.target=value}" :targets="targets" :locale="locale" label="链接目标" :max="2000"/>
    </div>
    <label>显示名称 · {{ siteLocaleNames[locale] }}
      <UInput v-model="link.label[locale]" class="w-full" :maxlength="80" placeholder="使用页面或栏目名称"
              :ui="{base: 'admin-input'}"/>
    </label>
    <AdminCommonSwitchField layout="row" size="medium" v-model="link.visible" label="在导航中显示"/>
  </div>
</template>
