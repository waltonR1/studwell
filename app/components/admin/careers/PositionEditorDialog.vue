<!-- 岗位编辑弹窗：使用入口的同一草稿，字段输入不创建全局状态或请求。 -->
<script setup lang="ts">
import type {AdminCareerPosition} from '#shared/schemas/admin/careers'
import type {SiteLocale} from '#shared/schemas/admin/site-settings'
import TextField from '~/components/admin/common/TextField.vue'
import EditorToolbar from '~/components/admin/website/shared/EditorToolbar.vue'
defineProps<{busy:boolean;dirty:boolean;writable:boolean;saveError:string}>()
const draft=defineModel<AdminCareerPosition|null>('draft',{required:true})
const locale=defineModel<SiteLocale>('locale',{required:true})
const emit=defineEmits<{close:[];save:[]}>()
const translation=computed(()=>{const content=draft.value?.content;if(!content)return undefined;return content.localized[locale.value]??(content.localized[locale.value]={title:'',department:'',location:'',responsibilities:[],requirements:[]})})
const statusLabel=(item:AdminCareerPosition)=>item.publishedReleaseId?'已发布':'未发布'
function setLines(key:'responsibilities'|'requirements',value:string){if(translation.value)translation.value[key]=value.split(/\r?\n/)}
const lineFields = [
  {key: 'responsibilities', label: '岗位职责'},
  {key: 'requirements', label: '任职要求'},
] as const
</script>
<template>
    <AdminCommonDialog :open="!!draft" :title="draft?.id ? '岗位内容' : '新增岗位'" size="large" :busy="busy" @close="emit('close')">
      <template v-if="draft && translation">
        <EditorToolbar v-model:locale="locale" :dirty="dirty" :disabled="busy" :status="statusLabel(draft)"/>
        <form id="career-position-editor" class="career-editor" @submit.prevent="emit('save')">
          <div class="career-editor-grid">
            <TextField v-model="translation.title" label="岗位名称" :disabled="!writable || busy"/>
            <TextField v-model="translation.department" label="所属部门" :disabled="!writable || busy"/>
            <TextField v-model="translation.location" label="工作地点" :disabled="!writable || busy"/>
          </div>
          <TextField
            v-for="field in lineFields"
            :key="field.key"
            :label="field.label"
            :model-value="translation[field.key].join('\n')"
            multiline
            :rows="5"
            :max="1000099"
            help="每行填写一项。"
            :disabled="!writable || busy"
            @update:model-value="setLines(field.key, $event)"
          />
          <AdminCommonFeedback v-if="saveError" tone="error">{{ saveError }}</AdminCommonFeedback>
        </form>
      </template>
      <template #actions>
        <UButton class="admin-button" :disabled="busy" @click="emit('close')">{{ dirty ? '放弃修改' : '关闭' }}</UButton>
        <UButton v-if="writable" class="admin-button admin-button-primary" type="submit" form="career-position-editor" :disabled="busy || (!!draft?.id && !dirty)">保存草稿</UButton>
      </template>
    </AdminCommonDialog>
</template>
<style scoped>
.career-editor { display: grid; gap: 10px; min-width: 0; }
.career-editor { gap: 20px; }
.career-editor-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; gap: 20px; }


@media (max-width: 767px) {
  .career-editor-grid { grid-template-columns: minmax(0, 1fr); }
}
</style>
