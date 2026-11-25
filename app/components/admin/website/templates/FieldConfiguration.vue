<!-- 展示固定字段结构；名称和约束可维护，层级与类型只读。 -->
<script setup lang="ts">
import {ChevronRight} from 'lucide-vue-next'
import type {SectionField} from '#shared/types/website/section-template'
import ImageRuleFields from './ImageRuleFields.vue'
const field=defineModel<SectionField>({required:true})
const props=defineProps<{path:string}>()
const typeName=computed(()=>({group:'字段分组',tree:'层级结构',list:'条目列表',text:'文本',number:'数字',media:field.value.mediaKind==='video'?'视频':'图片',boolean:'开关',link:'链接'})[field.value.kind])
const children=computed(()=>Object.keys(field.value.fields??{}).length)
</script>
<template>
 <details class="template-field-configuration" :class="{'is-root':props.path==='fields'}" :open="props.path==='fields'">
  <summary>
   <ChevronRight class="template-field-chevron" :size="15" aria-hidden="true" />
   <span class="template-field-heading"><strong>{{ field.label||props.path.split('.').at(-1) }}</strong><code>{{ props.path }}</code></span>
   <span class="template-field-type">{{ typeName }}</span><small v-if="children" class="template-field-count">{{ children }} 项</small>
  </summary>
  <div class="template-field-options">
   <div class="template-field-settings">
    <label>字段名称<UInput class="template-field-input" v-model="field.label" :maxlength="200" :ui="{base:'admin-input'}" /></label>
    <div v-if="['text','group','tree','list','link'].includes(field.kind)" class="template-field-switches">
     <AdminCommonSwitchField v-if="['text','group','tree','list'].includes(field.kind)" :model-value="field.searchable!==false" label="参与站内搜索" layout="row" @update:model-value="field.searchable=$event" />
     <AdminCommonSwitchField v-if="field.kind==='text'||field.kind==='link'" :model-value="field.required===true" label="发布时必填" layout="row" @update:model-value="field.required=$event" />
    </div>
    <div v-if="field.min!==undefined||field.max!==undefined||field.maxDepth!==undefined" class="template-field-limits">
     <label v-if="field.kind==='number'&&field.min!==undefined">最小值<UInput class="template-field-input" v-model.number="field.min" type="number" :ui="{base:'admin-input'}" /></label>
     <label v-if="field.max!==undefined">{{ field.kind==='text'?'最大字数':field.kind==='list'?'最多条目':'最大值' }}<UInput class="template-field-input" v-model.number="field.max" type="number" :ui="{base:'admin-input'}" /></label>
     <label v-if="field.maxDepth!==undefined">最大层级<UInput class="template-field-input" v-model.number="field.maxDepth" type="number" min="1" :ui="{base:'admin-input'}" /></label>
    </div>
   </div>
   <details v-if="field.imagePreset" class="template-field-image"><summary>图片显示与取景规则</summary><ImageRuleFields v-model="field.imagePreset" /></details>
   <div v-if="children||field.item" class="template-field-children">
    <AdminWebsiteTemplatesFieldConfiguration v-for="(_,key) in field.fields" :key="key" :model-value="field.fields![key]!" :path="props.path+'.'+key" @update:model-value="field.fields![key]=$event" />
    <AdminWebsiteTemplatesFieldConfiguration v-if="field.item" v-model="field.item" :path="props.path+'[]'" />
   </div>
  </div>
 </details>
</template>
<style scoped>
.template-field-configuration { min-width:0; border:1px solid #e2e9f1; border-radius:8px; background:white; overflow:clip; }
.template-field-configuration > summary { display:flex; align-items:center; gap:10px; padding:12px 14px; list-style:none; cursor:pointer; }
.template-field-configuration > summary::-webkit-details-marker { display:none; }
.template-field-configuration > summary:hover { background:#f7f9fc; }
.template-field-configuration > summary:focus-visible { outline:2px solid #3269a5; outline-offset:-2px; }
.template-field-chevron { flex:none; color:#8b9aab; transition:transform .15s; }
.template-field-configuration[open] > summary > .template-field-chevron { transform:rotate(90deg); }
.template-field-configuration[open] > summary { border-bottom:1px solid #edf0f5; background:#f8fafc; }
.template-field-heading { display:grid; gap:3px; min-width:0; flex:1; }
.template-field-heading strong { color:#3c536c; font-size:13px; font-weight:550; }
.template-field-heading code { color:#8a97a7; font-size:11px; font-weight:400; overflow-wrap:anywhere; }
.template-field-type { flex:none; border:1px solid #e2e8ef; border-radius:4px; padding:2px 6px; color:#748497; background:white; font-size:10px; font-weight:400; }
.template-field-count { color:#8a97a7; font-size:11px; white-space:nowrap; }
.template-field-options { display:grid; gap:16px; padding:16px; }
.template-field-settings { display:grid; gap:14px; }
.template-field-settings :deep(.template-field-input) { width:100%; max-width:480px; }
.template-field-settings :deep(.template-field-input .admin-input) { width:100%; }
.template-field-settings label { display:flex; flex-direction:column; gap:8px; min-width:0; color:#526278; font-size:12px; }
.template-field-switches,.template-field-limits { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
.template-field-children { display:grid; gap:10px; padding-left:12px; border-left:2px solid #e5ebf3; }
.template-field-image { padding:14px; border:1px solid #e4eaf2; border-radius:8px; }
.template-field-image > summary { color:#526b86; font-size:12px; cursor:pointer; }
.template-field-image[open] > summary { margin-bottom:16px; }
@media(max-width:650px){.template-field-options{padding:12px}.template-field-switches,.template-field-limits{grid-template-columns:minmax(0,1fr)}.template-field-count{display:none}.template-field-children{padding-left:6px}}
</style>
