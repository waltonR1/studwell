<!-- 按分组和表单项目维护展示文字；保留原定义引用，不编辑字段绑定或业务内容。 -->
<script setup lang="ts">
import {ChevronRight} from 'lucide-vue-next'
import {templateEditorGroups,templateEditorSections} from '~/utils/admin/website/template-configuration'
const props=defineProps<{editor:unknown}>()
const groups=computed(()=>templateEditorGroups(props.editor).map(group=>({...group,sections:templateEditorSections(group.entries)})))
const labels:Record<string,string>={label:'显示名称',help:'帮助说明',title:'分组标题',nameLabel:'名称标签',itemLabel:'条目名称',titleFallback:'默认标题'}
</script>
<template>
 <div class="template-editor-text">
  <details v-for="group in groups" :key="group.path" class="template-editor-group">
   <summary><ChevronRight :size="16" class="template-editor-chevron" aria-hidden="true" /><strong>{{ group.title }}</strong><span>{{ group.sections.length }} 个设置项</span></summary>
   <div class="template-editor-sections">
    <section v-for="section in group.sections" :key="section.path" class="template-editor-section">
     <h4>{{ section.title }}</h4>
     <div class="template-editor-inputs">
      <label v-for="entry in section.entries" :key="entry.path" :class="{'is-help':entry.key==='help'}">
       <span>{{ labels[entry.key]??entry.key }}</span>
       <textarea v-if="entry.key==='help'" :value="String(entry.target[entry.key])" class="admin-input" rows="2" maxlength="1000" placeholder="填写此项目的操作说明" @input="entry.target[entry.key]=($event.target as HTMLTextAreaElement).value" />
       <UInput v-else :model-value="String(entry.target[entry.key])" class="template-editor-input" :maxlength="1000" :ui="{base:'admin-input'}" @update:model-value="entry.target[entry.key]=String($event)" />
      </label>
     </div>
    </section>
   </div>
  </details>
  <AdminCommonDataState v-if="!groups.length" state="empty" title="使用自动生成的表单" description="字段名称可在“字段约束”中调整。" />
 </div>
</template>
<style scoped>
.template-editor-text { display:grid; gap:14px; min-width:0; }
.template-editor-group { border:1px solid #e1e8f1; border-radius:8px; overflow:hidden; }
.template-editor-group > summary { display:flex; align-items:center; gap:10px; padding:15px 16px; cursor:pointer; list-style:none; color:#3b526b; background:#f8fafc; }
.template-editor-group > summary::-webkit-details-marker { display:none; }
.template-editor-group > summary strong { font-size:13px; font-weight:600; }
.template-editor-group > summary > span { margin-left:auto; color:#7e8d9e; font-size:12px; }
.template-editor-chevron { flex-shrink:0; color:#8290a2; transition:transform .15s; }
.template-editor-group[open] .template-editor-chevron { transform:rotate(90deg); }
.template-editor-group > summary:focus-visible { outline:2px solid #3269a5; outline-offset:-2px; }
.template-editor-sections { padding:0 20px; }
.template-editor-section { padding:20px 0; }
.template-editor-section + .template-editor-section { border-top:1px solid #e8edf3; }
.template-editor-section h4 { margin:0 0 14px; font-size:13px; font-weight:600; line-height:1.6; color:#304860; overflow-wrap:anywhere; }
.template-editor-inputs { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px 20px; }
.template-editor-inputs label { display:flex; flex-direction:column; gap:8px; min-width:0; font-size:12px; color:#66788d; }
.template-editor-inputs .is-help { grid-column:1/-1; }
.template-editor-inputs :deep(.template-editor-input),.template-editor-inputs :deep(.admin-input) { width:100%; }
.template-editor-inputs textarea { resize:vertical; min-height:72px; }
@media(max-width:700px){.template-editor-inputs{grid-template-columns:minmax(0,1fr)}.template-editor-sections{padding:0 14px}}
</style>
