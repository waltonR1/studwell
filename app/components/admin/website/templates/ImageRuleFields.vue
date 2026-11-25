<!-- 图片规则按显示、取景和效果分组，控件复用后台输入和带文字的开关行。 -->
<script setup lang="ts">
import type {ImageRule} from '#shared/types/image-presentation'
const rule=defineModel<ImageRule>({required:true})
</script>
<template>
 <div class="template-rule-fields">
  <div class="template-rule-grid">
   <label>规则名称<UInput v-model="rule.label" :maxlength="200" :ui="{base:'admin-input'}" /></label>
   <label>显示方式<AdminCommonSelectField v-model="rule.fit" label="图片显示方式" :items="[{value:'cover',label:'裁切填满'},{value:'contain',label:'完整显示'}]" :body-lock="false" /></label>
  </div>
  <section class="template-image-rule-section">
   <h4>比例与取景</h4>
   <div class="template-rule-grid template-rule-grid-three">
    <label>电脑宽高比<UInput v-model.number="rule.desktopRatio" type="number" step="0.01" min="0.01" max="100" :ui="{base:'admin-input'}" /></label>
    <label>手机宽高比<UInput v-model.number="rule.mobileRatio" type="number" step="0.01" min="0.01" max="100" :ui="{base:'admin-input'}" /></label>
    <label>最大缩放倍数<UInput v-model.number="rule.maxZoom" type="number" min="1" max="100" step="0.1" :ui="{base:'admin-input'}" /></label>
   </div>
   <div class="template-rule-grid"><AdminCommonSwitchField v-model="rule.mobileEditable" label="单独调整手机取景" layout="row" /><AdminCommonSwitchField v-model="rule.overlay" label="启用遮罩" layout="row" /></div>
  </section>
  <section v-for="effect in (['opacity','brightness'] as const)" :key="effect" class="template-image-rule-section">
   <h4>{{ effect==='opacity'?'不透明度':'亮度' }}<span>{{ effect==='opacity'?'0 为完全透明，1 为完全不透明':'1 为原始亮度' }}</span></h4>
   <div class="template-rule-grid template-rule-grid-three">
    <label>默认值<UInput v-model.number="rule[effect].value" type="number" step="0.05" min="0" :max="effect==='opacity'?1:10" :ui="{base:'admin-input'}" /></label>
    <label>允许最小值<UInput v-model.number="rule[effect].min" type="number" step="0.05" min="0" :max="effect==='opacity'?1:10" :ui="{base:'admin-input'}" /></label>
    <label>允许最大值<UInput v-model.number="rule[effect].max" type="number" step="0.05" min="0" :max="effect==='opacity'?1:10" :ui="{base:'admin-input'}" /></label>
   </div>
   <AdminCommonSwitchField v-model="rule[effect].editable" :label="'允许内容维护人员调整'+(effect==='opacity'?'不透明度':'亮度')" layout="row" />
  </section>
 </div>
</template>
<style scoped>
.template-rule-fields { display:grid; gap:18px; min-width:0; }
.template-rule-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px 18px; }
.template-rule-grid-three { grid-template-columns:repeat(3,minmax(0,1fr)); }
.template-rule-fields label { display:flex; flex-direction:column; gap:8px; min-width:0; color:#526278; font-size:12px; }
.template-image-rule-section { display:grid; gap:14px; padding-top:18px; border-top:1px solid #e9edf3; }
.template-image-rule-section h4 { display:flex; flex-wrap:wrap; align-items:baseline; gap:12px; margin:0; color:#3b526b; font-size:13px; font-weight:600; }
.template-image-rule-section h4 span { color:#8490a0; font-size:11px; font-weight:400; }
@media(max-width:650px){.template-rule-grid,.template-rule-grid-three{grid-template-columns:minmax(0,1fr)}}
</style>
