<!-- 模板资料维护仅展示目录信息，定义与修订在独立配置窗口维护。 -->
<script setup lang="ts">
import {storeToRefs} from 'pinia'
import {useAdminWebsiteTemplatesStore} from '~/stores/admin/website-templates'
import {templateScope} from '~/utils/admin/website/templates'
const {draft,saving,saveError,dirty}=storeToRefs(useAdminWebsiteTemplatesStore())
defineProps<{canEdit:boolean}>()
defineEmits<{close:[];save:[]}>()
</script>
<template>
 <AdminCommonDialog :open="!!draft" :title="canEdit?'模板资料':'查看模板资料'" description="维护列表中的名称、说明、封面和启用状态。" :busy="saving" @close="$emit('close')">
  <form v-if="draft" id="template-metadata-form" class="template-metadata" @submit.prevent="$emit('save')">
   <div class="template-metadata-identity"><div><strong>{{ draft.name }}</strong><code>{{ draft.key }}</code></div><AdminCommonStatusBadge :tone="draft.enabledForNew?'success':'neutral'">{{ draft.enabledForNew?'允许新装配':'已禁用' }}</AdminCommonStatusBadge></div>
   <section class="template-metadata-section"><h3>基础资料</h3>
    <label><span>模板名称 <span class="template-required">*</span></span><UInput class="template-metadata-input" v-model="draft.name" :disabled="saving||!canEdit" required :maxlength="100" :ui="{base:'admin-input'}" /></label>
    <label>说明<textarea v-model="draft.description" class="admin-input" :disabled="saving||!canEdit" maxlength="1000" rows="3" placeholder="简要说明模板用途和适用场景" /></label>
    <div class="template-metadata-scope"><span>适用页面</span><strong>{{ templateScope(draft.applicablePages) }}</strong></div>
   </section>
   <section class="template-metadata-section"><h3>模板封面</h3><AdminMediaPicker v-model="draft.coverMediaId" field="template-cover" kind="image" label="选择封面" :disabled="saving||!canEdit" /></section>
   <section class="template-metadata-section"><div class="template-metadata-status"><div><h3>允许新装配</h3><p>禁用后不再用于新装配，已有区块保留。</p></div><AdminCommonSwitchField v-model="draft.enabledForNew" label="允许新装配" size="medium" :disabled="saving||!canEdit||(!draft.definition&&!draft.enabledForNew)" /></div></section>
   <AdminCommonFeedback v-if="!draft.definition" tone="warning">模板缺少有效定义，不能用于新装配。</AdminCommonFeedback>
   <AdminCommonFeedback v-if="saveError" tone="error">{{ saveError }}</AdminCommonFeedback>
  </form>
  <template #actions><AdminCommonDraftBadge v-if="canEdit" class="template-metadata-dirty" :dirty="!!dirty" /><UButton class="admin-button" :disabled="saving" @click="$emit('close')">{{ canEdit?'取消':'关闭' }}</UButton><UButton v-if="canEdit" form="template-metadata-form" type="submit" class="admin-button admin-button-primary" :disabled="saving||!dirty">{{ saving?'保存中…':'保存资料' }}</UButton></template>
 </AdminCommonDialog>
</template>
<style scoped>
.template-metadata { display:grid; gap:20px; }
.template-metadata-identity { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:14px 16px; border:1px solid #e2e9f2; border-radius:9px; background:#f7f9fc; }
.template-metadata-identity > div { display:grid; gap:4px; min-width:0; }
.template-metadata-identity strong { font-size:14px; color:#304860; }
.template-metadata-identity code { color:#8491a2; font-size:11px; overflow-wrap:anywhere; }
.template-metadata-section { display:grid; gap:14px; padding-bottom:20px; border-bottom:1px solid #e8edf3; }
.template-metadata-section:last-of-type { padding-bottom:0; border-bottom:0; }
.template-metadata-section h3 { margin:0; color:#3b526b; font-size:13px; font-weight:600; }
.template-metadata-section label { display:flex; flex-direction:column; gap:8px; color:#526278; font-size:13px; }
.template-metadata-section :deep(.template-metadata-input),.template-metadata-section :deep(.template-metadata-input .admin-input) { width:100%; }
.template-metadata-scope { display:flex; align-items:baseline; gap:16px; color:#8995a5; font-size:12px; line-height:1.7; }
.template-metadata-scope strong { color:#60738a; font-weight:400; }
.template-metadata-status { display:flex; align-items:center; justify-content:space-between; gap:16px; }
.template-metadata-status p { margin:6px 0 0; color:#8491a2; font-size:12px; line-height:1.7; }
.template-metadata-dirty { margin-right:auto; }
.template-required { color:#b94352; }
</style>
