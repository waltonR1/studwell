<script setup lang="ts">
const model=defineModel<string>({required:true})
defineProps<{label:string;multiline?:boolean;disabled?:boolean;help?:string;max?:number;rows?:number}>()
const fieldId=useId()
</script>
<template>
 <label class="section-editor-field" :for="fieldId">
  <span>{{ label }}</span>
  <textarea v-if="multiline" :id="fieldId" v-model="model" class="admin-input section-editor-textarea" :rows="rows??4" :maxlength="max??10000" :disabled="disabled" :aria-describedby="help?fieldId+'-help':undefined"/>
  <UInput v-else :id="fieldId" v-model="model" :maxlength="max??10000" :disabled="disabled" :aria-describedby="help?fieldId+'-help':undefined" :ui="{base:'admin-input'}"/>
  <span v-if="help" :id="fieldId+'-help'" class="admin-help">{{ help }}</span>
 </label>
</template>
<style scoped>
.section-editor-field { display: grid; gap: 10px; min-width: 0; }
.section-editor-textarea { width: 100%; resize: vertical; }
.section-editor-field .admin-help { margin: 0; font-weight: 400; }
</style>
