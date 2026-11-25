<!-- 集合表格展示：编辑事务由 useCollectionTableEditor 管理，父表单通过事件接收已确认内容。 -->
<script setup lang="ts">
import {adminMediaFileUrl} from '~/api/admin/media'
import {useCollectionTableEditor} from '~/composables/admin/website/useCollectionTableEditor'
import type {MediaSelection} from '#shared/types/image-presentation'
import type {CollectionEdit,CollectionEditorRow} from '~/utils/admin/website/collection-editor'
import type {BannerImagesField,CollectionField,ListAction,SectionFormProps,ValueField} from '~/types/admin/website-section-forms'
import type {LocalizedSections} from '~/types/admin/website-section-editors'
const props=withDefaults(defineProps<SectionFormProps&{field:CollectionField;basePath?:string;listTitle?:string;listDescription?:string}>(),{basePath:''})
const emit=defineEmits<{
 'update:modelValue':[value:LocalizedSections]
 'update:media':[key:string,value:MediaSelection]
 validation:[message:string]
}>()
defineSlots<{
 editor(props:{
  edit:CollectionEdit;row:CollectionEditorRow;shared:SectionFormProps['shared']
  change:(field:ValueField,base:string,value:unknown)=>void
  list:(field:CollectionField|ValueField,base:string,index:number,action:ListAction)=>Promise<void>
  media:(key:string,value:MediaSelection)=>void
  banner:(field:BannerImagesField,index:number|null,value:string|null)=>void
  replace:(value:LocalizedSections)=>void
  validation:(path:string,message:string)=>void
 }):unknown
}>()
const {rows,pendingEditMessage,store,linkTargetsError,linkTargetsPending,collapsed,error,editor,createLevel,createParentKey,sharedDraft,rootRows,structureError,search,visibility,writable,tableRows,activeRow,parents,editorLabel,createLevelOptions,createParentOptions,createParentLabel,localMessage,hasChildren,toggle,canMove,cell,changeCell,open,beginCreate,selectCreateLevel,selectCreateParent,close,change,list,media,banner,confirm,clearConfirmError,replaceLocal,childValidation,remove,move}=useCollectionTableEditor(props,emit)
</script>

<template>
 <div class="collection-table-field">
  <AdminCommonTreeListEditor v-model:search="search" v-model:visibility="visibility" :title="listTitle||field.label" :description="listDescription||''"
   :count="rootRows.length" :rows="tableRows" :label="field.label" :name-label="field.nameLabel??field.itemLabel" :create-label="field.tree&&field.tree.levels.length>1?'新增':'新增'+field.itemLabel"
   placeholder="" :empty-title="'暂无'+field.itemLabel" :empty-description="readonly?'当前没有可展示的条目。':'点击新增'+field.itemLabel+'开始维护。'" :note="field.help||''"
   :show-search="false" :show-visibility="false" :show-order="!field.fixedRows&&!readonly"
   :can-create="!field.fixedRows&&!readonly" :can-delete="!field.fixedRows&&!readonly" :min-width="field.tree?860:680"
   :depth="row=>Math.min(row.depth,10)" :has-children="row=>hasChildren(row)" :expanded="row=>!collapsed.includes(row.key)"
   :kind="row=>field.tree?.showLevelLabels?row.itemLabel:undefined"
   :can-move="(row,direction)=>!structureError&&canMove(row,direction)" :writable="writable" :busy="!!disabled&&!readonly" :filtered="false"
   @create="beginCreate" @toggle="toggle($event.key)" @move="move" @edit="open($event.key)" @remove="remove">
   <template #feedback><AdminCommonFeedback v-if="structureError" tone="warning">{{ structureError }}</AdminCommonFeedback><AdminCommonFeedback v-if="error" tone="error">{{ error }}</AdminCommonFeedback></template>
   <template #columns><colgroup/></template>
   <template #head><th v-for="column in field.columns" :key="column.field">{{ column.label }}</th><th v-if="field.tree?.showParent">上级</th></template>
   <template #cells="{row}">
    <td v-for="column in field.columns" :key="column.field" class="collection-table-summary">
     <img v-if="cell(row,column.field).mediaId" :src="adminMediaFileUrl(cell(row,column.field).mediaId!)" alt="" class="collection-table-image" loading="lazy">
     <AdminCommonSwitchField v-else-if="cell(row,column.field).checked!==undefined"
      :model-value="cell(row,column.field).checked===true" :label="row.name+'：'+column.label"
      :disabled="!writable||!!editor||!!structureError" @click.stop
      @update:model-value="changeCell(row,column.field,$event)"/>
     <AdminCommonSelectField v-else-if="column.editable&&cell(row,column.field).options"
      :model-value="cell(row,column.field).value" :items="cell(row,column.field).options??[]" :label="row.name+'：'+column.label"
      :disabled="!writable||!!editor||!!structureError" :body-lock="false"
      @update:model-value="changeCell(row,column.field,$event)"/>
     <span v-else>{{ cell(row,column.field).text }}</span>
    </td>
    <td v-if="field.tree?.showParent">{{ rows.find(item=>item.key===row.parent)?.title||'—' }}</td>
   </template>
  </AdminCommonTreeListEditor>
   <AdminCommonFeedback v-if="linkTargetsError" tone="error">
    跳转目标加载失败：{{ linkTargetsError }}
    <template #action><UButton class="admin-button" :disabled="linkTargetsPending" @click="store.loadNavigationTargets(true)">{{ linkTargetsPending ? '重试中…' : '重试' }}</UButton></template>
   </AdminCommonFeedback>
  <AdminCommonDialog :open="!!editor" :title="(readonly?'查看':editor?.mode==='add'?'新增':'编辑')+editorLabel" size="medium" :busy="disabled&&!readonly" @close="close">
   <div v-if="editor&&activeRow" class="collection-entry-fields">
    <template v-if="editor.mode==='add'&&field.tree&&field.tree.levels.length>1">
     <label class="section-editor-field">节点类型
      <AdminCommonSelectField :model-value="String(createLevel)" label="节点类型" :body-lock="false" :disabled="disabled||readonly" :items="createLevelOptions" @update:model-value="selectCreateLevel"/>
     </label>
     <label v-if="createLevel>0" class="section-editor-field">所属{{ createParentLabel }}
      <AdminCommonSelectField :model-value="createParentKey" :label="'所属'+createParentLabel" :body-lock="false" :disabled="disabled||readonly" :items="createParentOptions" @update:model-value="selectCreateParent"/>
     </label>
    </template>
    <label v-if="field.tree?.allowReparent&&editor.originalParent!==null" class="section-editor-field">上级节点
     <AdminCommonSelectField :model-value="editor.parent??''" label="上级节点" :items="parents" :body-lock="false" :disabled="!writable||!!structureError" @update:model-value="editor.parent=$event;clearConfirmError()"/>
    </label>
    <slot name="editor" :edit="editor" :row="activeRow" :shared="sharedDraft" :change="change" :list="list" :media="media" :banner="banner" :replace="replaceLocal" :validation="childValidation"/>
    <AdminCommonFeedback v-if="localMessage" tone="error">{{ localMessage }}</AdminCommonFeedback>
   </div>
   <template #actions><p v-if="pendingEditMessage" class="admin-help collection-entry-hint">{{ pendingEditMessage }}</p><UButton class="admin-button" :disabled="disabled&&!readonly" @click="close">{{ readonly?'关闭':'取消' }}</UButton><UButton v-if="!readonly" class="admin-button admin-button-primary" :disabled="!writable||!!localMessage" @click="confirm">确认</UButton></template>
  </AdminCommonDialog>
 </div>
</template>

<style scoped>
.collection-table-field { display:grid; gap:16px; min-width:0; }
.collection-table-summary { max-width:360px; }
.collection-table-summary > span { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; overflow-wrap:anywhere; }
.collection-table-image { display:block; width:88px; height:56px; border-radius:5px; object-fit:cover; }
.collection-entry-fields { display:grid; gap:24px; min-width:0; }
.collection-entry-hint { flex-basis:100%; margin:0; }
</style>
