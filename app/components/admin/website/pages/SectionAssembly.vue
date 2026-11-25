<script setup lang="ts">
import TemplateBusinessBadges from './TemplateBusinessBadges.vue'
import {templateBusinessModules,templateBusinessDisabled,templateBusinessLabel} from '~/utils/admin/website/template-business'
import PreviewDialog from '~/components/admin/preview/PreviewDialog.vue'
import type {SiteLocale} from '#shared/schemas/admin/site-settings'
const {locale}=defineProps<{locale:SiteLocale}>()
const route=useRoute(),previewOpen=ref(false)
const previewSectionId=ref<string>()
function openPreview(id?:string){previewSectionId.value=id;previewOpen.value=true}

import {storeToRefs} from 'pinia'
import type {WebsiteSectionRecord} from '#shared/types/admin/website'
import {useAdminWebsitePagesStore} from '~/stores/admin/website-pages'

const store=useAdminWebsitePagesStore()
const {draft,record,busy,canEdit,placementIssues,assemblyEditor:editor,assemblyEditorError}=storeToRefs(store)
const emit=defineEmits<{remove:[id:string];closeEditor:[];edit:[id:string]}>()

type SectionRow={id:string;name:string;visible:boolean;section:WebsiteSectionRecord}

const sectionSearch=ref(''),sectionVisibility=ref(''),appliedSectionSearch=ref(''),appliedSectionVisibility=ref('')
const sectionFiltered=computed(()=>!!appliedSectionSearch.value||!!appliedSectionVisibility.value)
const matchText=(value:string,query:string)=>!query||value.toLowerCase().includes(query.trim().toLowerCase())
const matchVisibility=(value:boolean,filter:string)=>!filter||value===(filter==='visible')

function querySections(){appliedSectionSearch.value=sectionSearch.value;appliedSectionVisibility.value=sectionVisibility.value}

const sectionRows=computed<SectionRow[]>(()=>(draft.value?.sections??[])
 .filter(section=>matchText(section.name,appliedSectionSearch.value)&&matchVisibility(section.visible,appliedSectionVisibility.value))
 .map(section=>({id:section.id,name:section.name,visible:section.visible,section}))
 .sort((a,b)=>a.section.sortOrder-b.section.sortOrder||a.id.localeCompare(b.id)))

const sectionIndex=(row:SectionRow)=>draft.value!.sections.findIndex(section=>section.id===row.id)
const canMoveSection=(row:SectionRow,direction:'up'|'down')=>store.canMove(sectionIndex(row),direction==='up'?-1:1)
function moveSection(row:SectionRow,direction:'up'|'down'){store.move(sectionIndex(row),direction==='up'?-1:1)}
const setSectionVisible=(row:SectionRow,value:boolean)=>{if(canEdit.value&&!busy.value)row.section.visible=value}
const editSection=(row:SectionRow)=>emit('edit',row.id)
const removeSection=(row:SectionRow)=>emit('remove',row.id)
const templateName=(row:SectionRow)=>draft.value?.templates.find(template=>template.id===row.section.templateId)?.name||row.section.definition?.name||'模板不可用'

function openAssembly(){
  store.editAssembly()
}
const availableTemplates=computed(()=>{
  const page=draft.value
  if(!page)return[]
  return page.templates.filter(template=>{
    if(!template.enabledForNew||!template.definition)return false
    return true
  })
})
const selectedTemplate=computed(()=>draft.value?.templates.find(template=>template.id===editor.value?.templateId))
function changeTemplate(value:string){
 if(!editor.value)return
 if(editor.value.kind==='section'){
  const previous=availableTemplates.value.find(template=>template.id===editor.value?.templateId)?.name
  if(!editor.value.name.trim()||editor.value.name===previous)editor.value.name=availableTemplates.value.find(template=>template.id===value)?.name??''
 }
 editor.value.templateId=value
}

</script>

<template>
 <template v-if="draft">
  <div class="assembly-tables">
<AdminCommonTreeListEditor v-model:search="sectionSearch" v-model:visibility="sectionVisibility" title="区块装配" description="维护区块内容、顺序和显示状态"
    :count="draft.sections.length" :rows="sectionRows" label="区块装配列表" name-label="区块名称" create-label="新增区块" placeholder="搜索区块名称"
    :writable="canEdit" :busy="busy" :filtered="sectionFiltered" :can-move="canMoveSection"
    empty-title="暂无匹配区块" empty-description="新增区块并保存草稿后，可进入内容编辑。" note="区块按列表顺序展示。"
    @query="querySections" @create="openAssembly" @move="moveSection" @visibility="setSectionVisible" @edit="editSection" @remove="removeSection">
    <template #actions><UButton type="button" class="admin-button" :disabled="busy||!record?.persisted" :title="record?.persisted?'仅预览已保存的整页草稿，不包含未保存修改。':'请先保存页面草稿'" @click="openPreview()">预览已保存草稿</UButton></template>
    <template #row-actions="{row}"><UButton class="admin-button" :disabled="busy||!record?.sections.some(section=>section.id===row.id)" title="仅展示当前区块已保存的草稿；新增区块请先保存。" @click="openPreview(row.id)">预览</UButton></template>
    <template #feedback><AdminCommonFeedback v-if="placementIssues.length" tone="error">请调整以下区块的模板：{{ placementIssues.join('、') }}。</AdminCommonFeedback></template>
    <template #columns><colgroup><col style="width:28%"><col style="width:22%"><col style="width:16%"><col style="width:12%"><col style="width:22%"></colgroup></template>
    <template #head><th>区块模板</th></template>
    <template #cells="{row}"><td>{{ templateName(row) }}<TemplateBusinessBadges :modules="templateBusinessModules(row.section.businessModules ? row.section : draft.templates.find(template=>template.id===row.section.templateId))"/></td></template>
   </AdminCommonTreeListEditor>
  </div>

  <PreviewDialog :open="previewOpen" :src="'/admin/website/'+encodeURIComponent(String(route.params.code))+'/preview?mode=draft&locale='+locale+(previewSectionId?'&sectionId='+encodeURIComponent(previewSectionId):'')" :title="previewSectionId?'预览已保存区块':'预览已保存草稿'" :description="previewSectionId?'仅展示当前区块已保存的草稿，包括暂时隐藏的区块；不包含未保存修改。':'展示已保存的整页装配和区块内容，不包含当前未保存的修改。'" @close="previewOpen=false" />
  <AdminCommonDialog :open="!!editor" title="新增区块" size="medium" :busy="busy" @close="emit('closeEditor')">
   <fieldset v-if="editor" class="site-edit-fields" :disabled="!canEdit||busy"><legend class="sr-only">区块配置</legend>
   <template v-if="editor">
    <label v-if="editor.kind==='section'">区块名称<UInput v-model="editor.name" :maxlength="100" placeholder="默认使用模板名称" :ui="{base:'admin-input'}"/></label>
    <label>区块模板<AdminCommonSelectField :model-value="editor.templateId" label="区块模板" :body-lock="false" placeholder="请选择样式" :items="availableTemplates.map(template=>({value:template.id,label:templateBusinessLabel(template)}))" @update:model-value="changeTemplate"/></label>
    <TemplateBusinessBadges :modules="templateBusinessModules(selectedTemplate)"/>
    <AdminCommonFeedback v-if="templateBusinessDisabled(selectedTemplate)" tone="warning">所选模板关联业务已停用，可先编辑草稿；发布页面前请前往业务管理启用。</AdminCommonFeedback>
    <AdminCommonSwitchField layout="row" size="medium" v-if="editor.kind==='section'" v-model="editor.visible" label="显示区块" :disabled="busy||!canEdit"/>
   </template>
   <AdminCommonFeedback v-if="assemblyEditorError" tone="error">{{ assemblyEditorError }}</AdminCommonFeedback>
   </fieldset>
   <template #actions><UButton class="admin-button" :disabled="busy" @click="emit('closeEditor')">{{ canEdit?'取消':'关闭' }}</UButton><UButton v-if="canEdit" class="admin-button admin-button-primary" :disabled="busy" @click="store.confirmAssembly()">确认</UButton></template>
  </AdminCommonDialog>
 </template>
</template>

<style scoped>
.assembly-tables { display: grid; gap: 20px; }
</style>
