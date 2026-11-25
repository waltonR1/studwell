<script setup lang="ts">
import {storeToRefs} from 'pinia'
import {useAdminSiteSettingsStore} from '~/stores/admin/site-settings'
import {siteLocaleNames} from '#shared/config/admin/site-settings'
import type {SiteLocale,SiteLink} from '#shared/schemas/admin/site-settings'
import {siteTargetLabel} from '~/utils/admin/site-settings/labels'
import LinkFields from './LinkFields.vue'

const store=useAdminSiteSettingsStore()
const {draft,record,canEdit,busy,navigationEditor:linkEditor,editorError:dialogError}=storeToRefs(store)
const props=defineProps<{locale:SiteLocale}>()
const locale=computed(()=>props.locale)
const emit=defineEmits<{close:[];confirm:[]}>()
const targets=computed(()=>record.value?.targets??[])
const targetName=(link:SiteLink)=>siteTargetLabel(link,targets.value,locale.value)
const parentOptions = computed(() => {
  const editor = linkEditor.value
  if (!editor) return []
  if (editor.scope === 'header' || editor.scope === 'child') return [
    {value: '', label: '无上级（一级导航）'},
    ...draft.value.header.items.filter(item => !(editor.scope === 'header' && item.id === editor.value.id)).map(item => ({
      value: item.id,
      label: item.label[locale.value] || targetName(item)
    })),
  ]
  if (editor.kind === 'group') return [{value: '', label: '无上级（页脚分组）'}]
  return draft.value.footer.groups.map(group => ({value: group.id, label: group.title[locale.value] || '链接分组'}))
})
const changeNodeKind = store.changeNodeKind
</script>
<template>
<AdminCommonDialog :open="!!linkEditor" :title="!canEdit?'查看导航':linkEditor&&linkEditor.index<0?'新增导航':'编辑导航'" size="medium" :busy="busy" @close="emit('close')">
 <fieldset v-if="linkEditor" class="site-edit-fields" :disabled="!canEdit||busy"><legend class="sr-only">导航详情</legend>
 <template v-if="linkEditor">
      <div v-if="linkEditor.scope === 'group' && linkEditor.index < 0" class="site-field">
      <span>导航类型</span>
      <AdminCommonSelectField
                              :model-value="linkEditor.kind"
                              :items="[{value:'group',label:'分组'},{value:'link',label:'链接'}]" label="导航类型"
                              :body-lock="false" @update:model-value="changeNodeKind"/>
      </div>
      <div v-if="linkEditor.kind === 'link'" class="site-field">
      <span>{{ linkEditor.scope === 'header' || linkEditor.scope === 'child' ? '上级导航' : '所属分组' }}</span>
      <AdminCommonSelectField v-model="linkEditor.parent" :items="parentOptions" :label="linkEditor.scope === 'header' || linkEditor.scope === 'child' ? '上级导航' : '所属分组'" :body-lock="false"/>
      </div>
      <LinkFields v-if="linkEditor.kind === 'link'" v-model:link="linkEditor.value" :targets="targets"
                      :locale="locale"/>
      <template v-else>
        <label>分组名称 · {{ siteLocaleNames[locale] }}
          <UInput v-model="linkEditor.value.label[locale]" class="w-full" :maxlength="80" :ui="{base: 'admin-input'}"/>
        </label>
        <AdminCommonSwitchField layout="row" size="medium" v-model="linkEditor.value.visible" label="在导航中显示" :disabled="busy||!canEdit"/>
      </template>
 </template>
 <AdminCommonFeedback v-if="dialogError" tone="error">{{ dialogError }}</AdminCommonFeedback>
 </fieldset>
 <template #actions><UButton class="admin-button" :disabled="busy" @click="emit('close')">{{ canEdit?'取消':'关闭' }}</UButton><UButton v-if="canEdit" class="admin-button admin-button-primary" :disabled="busy" @click="emit('confirm')">确认</UButton></template>
</AdminCommonDialog>
</template>
