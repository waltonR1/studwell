<!-- 模板维护按步骤和配置职责分组，标签页、输入及弹窗复用现有后台组件。 -->
<script setup lang="ts">
import {storeToRefs} from 'pinia'
import {FileJson,Download,CheckCircle2} from 'lucide-vue-next'
import {useAdminWebsiteTemplatesStore} from '~/stores/admin/website-templates'
import EditorTextConfiguration from './EditorTextConfiguration.vue'
import FieldConfiguration from './FieldConfiguration.vue'
import ImageRuleFields from './ImageRuleFields.vue'
const {configuration:draft,configurationError:error,saving,configurationDirty:dirty}=storeToRefs(useAdminWebsiteTemplatesStore())
const json=defineModel<string>('json',{default:''})
defineEmits<{close:[];save:[];importJson:[];exportDefinition:[];importFile:[event:Event]}>()
const panel=ref('general')
watch(()=>draft.value,value=>{panel.value=value?.id?'general':'connection'},{immediate:true})
watch(()=>!!draft.value?.definition,(loaded,previous)=>{if(loaded&&!previous)panel.value='general'})
const tabs=computed(()=>[
 ...(!draft.value?.id?[{label:'组件与导入',value:'connection',slot:'connection'}]:[]),
 {label:'基础设置',value:'general',slot:'general',disabled:!draft.value?.definition},
 {label:'字段约束',value:'fields',slot:'fields',disabled:!draft.value?.definition},
 {label:'共享图片',value:'media',slot:'media',disabled:!draft.value?.definition},
 {label:'表单文字',value:'editor',slot:'editor',disabled:!draft.value?.definition},
])
const allowedPages=computed({get:()=>draft.value?.definition?.allowedPages==='all'?'all':draft.value?.definition?.allowedPages.join(', ')??'',set:value=>{if(draft.value?.definition)draft.value.definition.allowedPages=value.trim()==='all'?'all':value.split(',').map(key=>key.trim()).filter(Boolean)}})
</script>
<template>
 <div class="template-configuration-dialog">
  <AdminCommonDialog :open="!!draft" :title="draft?.id?'模板配置':'登记区块模板'" :description="draft?.id?'调整配置并保存为新修订。':'连接已部署的组件，导入初始定义。'" size="wide" :busy="saving" @close="$emit('close')">
   <form v-if="draft" id="template-configuration-form" class="template-configuration" novalidate @submit.prevent="$emit('save')">
    <div class="template-configuration-identity">
     <div><strong>{{ draft.definition?.name||'新模板' }}</strong><code v-if="draft.definition">{{ draft.definition.key }}</code><span v-else>先完成组件连接与定义导入</span></div>
     <AdminCommonStatusBadge v-if="draft.id" tone="neutral">当前修订 {{ draft.revision }}</AdminCommonStatusBadge>
     <AdminCommonStatusBadge v-else :tone="draft.definition?'success':'neutral'">{{ draft.definition?'定义已载入':'等待导入' }}</AdminCommonStatusBadge>
    </div>
    <AdminCommonFeedback v-if="error" tone="error">{{ error }}</AdminCommonFeedback>
    <fieldset :disabled="saving" class="template-configuration-fields">
     <UTabs v-model="panel" :items="tabs" :unmount-on-hide="false" class="template-configuration-tabs" :ui="{list:'template-tabs-list',trigger:'template-tabs-trigger',content:'template-tabs-content'}">
      <template #connection>
       <section class="template-config-section">
        <header><h3>连接组件</h3><p>手动填写项目相对路径，组件需先打包部署。</p></header>
        <div class="template-config-grid">
         <label class="template-config-wide"><span>公开组件路径 <span class="template-required">*</span></span><UInput v-model="draft.publicComponentPath" required placeholder="app/components/public/sections/…/Section.vue" :ui="{base:'admin-input'}" /></label>
         <label class="template-config-wide">预览组件路径<UInput v-model="draft.previewComponentPath" placeholder="留空则使用公开组件" :ui="{base:'admin-input'}" /></label>
         <label class="template-config-wide">模板说明<textarea v-model="draft.description" class="admin-input" rows="2" maxlength="1000" placeholder="说明适用场景或使用方式" /></label>
        </div>
       </section>
       <section class="template-config-section">
        <header><h3><FileJson :size="17" aria-hidden="true" />导入初始定义</h3><p>选择 JSON 文件，或展开粘贴区录入。</p></header>
        <label class="template-file-input">JSON 定义文件<UInput type="file" accept=".json,application/json" :ui="{base:'admin-input'}" @change="$emit('importFile',$event)" /><span class="admin-help">文件不超过 1 MB。</span></label>
        <details class="template-paste-panel"><summary>粘贴 JSON 定义</summary><textarea v-model="json" class="admin-input template-definition-json" rows="9" spellcheck="false" aria-label="模板定义 JSON" placeholder="在此粘贴完整模板定义" /><UButton class="admin-button" :disabled="!json.trim()" @click="$emit('importJson')">校验并载入</UButton></details>
        <p v-if="draft.definition" class="template-import-success"><CheckCircle2 :size="16" aria-hidden="true" />已载入 {{ draft.definition.name }}，可继续核对基础设置和字段约束。</p>
       </section>
      </template>
      <template #general>
       <template v-if="draft.definition">
        <section class="template-config-section">
         <header><h3>模板信息</h3><p>用于模板识别、分类和页面装配。</p></header>
         <div class="template-config-grid">
          <label>模板代称<UInput v-model="draft.definition.key" :disabled="!!draft.id" required :ui="{base:'admin-input'}" /></label>
          <label>分类<UInput :model-value="draft.definition.category??''" placeholder="未分类" :maxlength="100" :ui="{base:'admin-input'}" @update:model-value="draft.definition.category=String($event).trim()||undefined" /></label>
          <label class="template-config-wide"><span>定义名称 <span class="template-required">*</span></span><UInput v-model="draft.definition.name" required :maxlength="draft.id?200:100" :ui="{base:'admin-input'}" /></label>
         </div>
        </section>
        <section class="template-config-section">
         <header><h3>装配范围</h3><p>页面编码用英文逗号分隔；适用范围填写 all 表示全部页面。</p></header>
         <div class="template-config-grid"><label>适用页面<UInput v-model="allowedPages" placeholder="all" :ui="{base:'admin-input'}" /></label></div>
        </section>
       </template>
      </template>
      <template #fields><section v-if="draft.definition" class="template-config-section"><header><h3>字段约束</h3><p>调整已有字段的名称、搜索和校验规则；字段路径与类型保持固定。</p></header><FieldConfiguration v-model="draft.definition.fields" path="fields" /></section></template>
      <template #media>
       <section v-if="draft.definition" class="template-config-section"><header><h3>共享图片规则</h3><p>区块内字段的图片规则在“字段约束”中维护。</p></header>
        <template v-for="slot in draft.definition.mediaSlots" :key="slot.key"><details v-if="slot.imagePreset" class="template-rule-panel"><summary><span>{{ slot.name }}</span><code>{{ slot.key }}</code></summary><ImageRuleFields v-model="slot.imagePreset" /></details></template>
        <AdminCommonDataState v-if="!draft.definition.mediaSlots.some(slot=>slot.imagePreset)" state="empty" title="没有共享图片规则" description="此模板未设置共享图片槽位，或只使用内容字段中的图片。" />
       </section>
      </template>
      <template #editor>
       <section class="template-config-section"><header><h3>后台表单文字</h3><p>按表单项目维护名称和帮助说明。</p></header>
        <EditorTextConfiguration :editor="draft?.definition?.editor" />
       </section>
      </template>
     </UTabs>
    </fieldset>
   </form>
   <template #actions>
    <div class="template-config-footer"><AdminCommonDraftBadge :dirty="dirty" /><span v-if="draft?.id" class="admin-help">已有区块与发布历史保留原修订。</span><span v-else class="admin-help">登记后默认禁用。</span></div>
    <UButton v-if="draft?.definition" class="admin-button" :disabled="saving" @click="$emit('exportDefinition')"><Download :size="14" aria-hidden="true" />导出定义</UButton>
    <UButton class="admin-button" :disabled="saving" @click="$emit('close')">取消</UButton>
    <UButton form="template-configuration-form" type="submit" class="admin-button admin-button-primary" :disabled="saving||!draft?.definition||!dirty">{{ saving?'保存中…':draft?.id?'保存新修订':'登记模板' }}</UButton>
   </template>
  </AdminCommonDialog>
 </div>
</template>
<style scoped>
.template-configuration,.template-configuration-fields { display:grid; gap:16px; min-width:0; }
.template-configuration > fieldset.template-configuration-fields { border:0; padding:0; margin:0; background:transparent; box-shadow:none; }
.template-configuration-identity { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:14px 16px; border:1px solid #e2e9f2; border-radius:10px; background:#f7f9fc; }
.template-configuration-identity > div { display:grid; gap:4px; min-width:0; }
.template-configuration-identity strong { font-size:15px; color:#293f58; }
.template-configuration-identity code,.template-configuration-identity > div > span { color:#778497; font-size:12px; overflow-wrap:anywhere; }
.template-configuration-tabs :deep([data-slot='list']) { display:flex; gap:4px; padding:4px; margin-bottom:20px; border:1px solid #e3e9f0; border-radius:9px; background:#f3f6fa; overflow-x:auto; }
.template-configuration-tabs :deep([data-slot='trigger']) { flex:1 0 auto; padding:9px 14px; border:0; border-radius:6px; background:transparent; color:#6c7d90; font-size:13px; font-weight:550; white-space:nowrap; cursor:pointer; }
.template-configuration-tabs :deep([data-slot='trigger'][data-state='active']) { background:#fff; color:#285e94; box-shadow:0 1px 4px #233b5414; }
.template-configuration-tabs :deep([data-slot='trigger']:disabled) { opacity:.45; cursor:not-allowed; }
.template-configuration-tabs :deep([data-slot='trigger']:focus-visible) { outline:2px solid #3269a5; outline-offset:-2px; }
.template-configuration-tabs :deep([data-slot='indicator']) { display:none; }
.template-configuration-tabs :deep([data-slot='content'][data-state='inactive']) { display:none; }
.template-config-section { display:grid; gap:16px; margin-bottom:20px; padding:20px; border:1px solid #e4eaf1; border-radius:10px; background:white; }
.template-config-section:last-child { margin-bottom:0; }
.template-config-section header { display:grid; gap:6px; }
.template-config-section h3 { display:flex; align-items:center; gap:8px; margin:0; font-size:14px; font-weight:600; color:#304860; }
.template-config-section header p { margin:0; color:#7b8796; font-size:12px; line-height:1.7; }
.template-config-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px 20px; }
.template-config-grid label,.template-file-input { display:flex; flex-direction:column; gap:8px; min-width:0; color:#526278; font-size:13px; }
.template-config-grid :deep(.admin-input) { width:100%; }
.template-config-wide { grid-column:1/-1; }
.template-required { color:#b94352; }
.template-file-input { padding:16px; border:1px dashed #c9d7e7; border-radius:8px; background:#f8fafc; }
.template-file-input :deep(input[type='file']) { max-width:100%; font-size:12px; }
.template-file-input :deep(input[type='file']::file-selector-button) { margin-right:12px; padding:6px 10px; border:1px solid #cbdcf0; border-radius:5px; background:#edf4fc; color:#285e94; cursor:pointer; }
.template-paste-panel { padding:14px; border:1px solid #e3e9f0; border-radius:8px; }
.template-paste-panel summary { color:#526b86; font-size:13px; cursor:pointer; }
.template-definition-json { width:100%; margin:12px 0; font-family:monospace; font-size:12px; resize:vertical; }
.template-import-success { display:flex; align-items:center; gap:8px; margin:0; color:#28724f; font-size:12px; line-height:1.6; }
.template-rule-panel { border:1px solid #e1e8f1; border-radius:8px; padding:14px 16px; }
.template-rule-panel > summary { display:flex; align-items:center; justify-content:space-between; gap:12px; color:#3b526b; font-size:13px; font-weight:550; cursor:pointer; }
.template-rule-panel summary code,.template-rule-panel summary small { font-size:11px; color:#7e8d9e; font-weight:400; }
.template-rule-panel[open] > summary { margin-bottom:16px; }
.template-config-footer { display:flex; align-items:center; flex-wrap:wrap; gap:10px; margin-right:auto; }
.template-config-footer .admin-help { margin:0; font-size:12px; }
@media(max-width:700px){.template-config-grid{grid-template-columns:minmax(0,1fr)}.template-config-section{padding:14px}.template-configuration-identity{align-items:flex-start}.template-config-footer{width:100%}.template-config-footer .admin-help{display:none}}
</style>
