<script setup lang="ts">
import {emptySiteText} from '#shared/utils/admin/site-settings'
import {storeToRefs} from 'pinia'
import LinkTargetSelect from '~/components/admin/website/shared/LinkTargetSelect.vue'
import {useAdminSiteSettingsStore} from '~/stores/admin/site-settings'
import type {SiteLocale} from '#shared/schemas/admin/site-settings'

const store = useAdminSiteSettingsStore()
const {draft, record, canEdit, busy} = storeToRefs(store)
const targets = computed(() => record.value?.targets ?? [])
const disabled = computed(() => !canEdit.value || busy.value)

defineProps<{locale: SiteLocale}>()
function addContact() {
  if (disabled.value || draft.value.footer.contacts.length >= 30) return
  draft.value.footer.contacts.push({id: 'contact_' + crypto.randomUUID().replaceAll('-', ''), kind: 'text', label: emptySiteText(), value: emptySiteText(), visible: true})
}
const kinds = [{value: 'text', label: '文本'}, {value: 'email', label: '邮箱'}, {value: 'phone', label: '电话'}]
</script>
<template>
  <section class="admin-section site-card footer-form">
    <h3>简介与版权</h3>
    <div class="site-fields">
      <AdminCommonTextField :model-value="draft.footer.description[locale] ?? ''" @update:model-value="draft.footer.description[locale] = $event" class="site-wide" label="页脚简介" multiline :rows="4" :max="1000" :disabled="disabled"/>
      <AdminCommonTextField :model-value="draft.footer.copyrightHolder[locale] ?? ''" @update:model-value="draft.footer.copyrightHolder[locale] = $event" class="site-wide" label="版权归属" :max="200" :disabled="disabled" :help="'© ' + new Date().getFullYear() + ' ' + draft.footer.copyrightHolder[locale]"/>
    </div>
  </section>
  <section class="admin-section site-card footer-form">
    <h3>联系信息</h3>
    <div class="footer-contact-content">
      <p class="site-help footer-contact-help">填写当前语言页脚展示的内容，与“联系我们”页面分别维护。</p>
      <div class="site-fields">
        <AdminCommonTextField :model-value="draft.footer.contactTitle[locale] ?? ''" @update:model-value="draft.footer.contactTitle[locale] = $event" label="联系区标题" :max="80" :disabled="disabled"/>
        <div class="site-field"><span>联系区链接</span>
          <LinkTargetSelect v-model="draft.footer.contactTarget" :targets="targets" :locale="locale" label="联系区链接" allow-empty :max="2000" :disabled="disabled"/>
        </div>
      </div>
      <section v-for="(contact, index) in draft.footer.contacts" :key="contact.id" class="footer-contact-item" :aria-label="'联系条目 ' + (index + 1)">
        <div class="footer-contact-toolbar">
          <strong>联系条目 {{ index + 1 }}</strong>
          <AdminCommonRowActions>
            <UButton class="admin-button" :disabled="disabled || index === 0" @click="store.moveNavigation(draft.footer.contacts, index, -1)">上移</UButton>
            <UButton class="admin-button" :disabled="disabled || index === draft.footer.contacts.length - 1" @click="store.moveNavigation(draft.footer.contacts, index, 1)">下移</UButton>
            <UButton class="admin-button" data-tone="danger" :disabled="disabled" @click="store.removeNavigation(draft.footer.contacts, index)">移除</UButton>
          </AdminCommonRowActions>
        </div>
        <div class="site-fields">
          <div class="site-field"><span>类型</span><AdminCommonSelectField v-model="contact.kind" label="联系条目类型" :items="kinds" :disabled="disabled"/></div>
          <AdminCommonTextField :model-value="contact.label[locale] ?? ''" @update:model-value="contact.label[locale] = $event" label="名称" :max="80" :disabled="disabled"/>
          <label class="site-wide site-field"><span>内容</span><UInput v-model="contact.value[locale]" :type="contact.kind === 'email' ? 'email' : contact.kind === 'phone' ? 'tel' : 'text'" :disabled="disabled" :maxlength="contact.kind === 'email' ? 254 : contact.kind === 'phone' ? 50 : 500" :ui="{base: 'admin-input'}"/></label>
          <AdminCommonSwitchField v-model="contact.visible" class="site-wide" layout="row" label="显示条目" :disabled="disabled"/>
        </div>
      </section>
      <div><UButton class="admin-button" :disabled="disabled || draft.footer.contacts.length >= 30" @click="addContact">添加联系条目</UButton></div>
    </div>
  </section>
</template>
<style scoped>
.footer-form .site-fields { align-items: start; }
.footer-form :deep(.site-fields > label), .footer-form .site-field { gap: 12px; }
.footer-form :deep(.site-fields [data-slot='root']), .footer-form :deep(.site-fields .admin-input) { width: 100%; min-width: 0; box-sizing: border-box; }
.footer-contact-content { display: grid; gap: 28px; max-width: 1000px; min-width: 0; }
.footer-contact-help { margin: 0; }
.footer-contact-item { display: grid; gap: 20px; min-width: 0; padding-top: 28px; border-top: 1px solid var(--admin-view-border, #e1e8f1); }
.footer-contact-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.footer-contact-toolbar > strong { font-size: 14px; font-weight: 600; }
</style>
