<!-- 字典展示组件，保存与确认交互由所属 composable 接线。 -->
<script setup lang="ts">
import DictionaryTypeForm from './DictionaryTypeForm.vue'
import DictionaryItemsSection from './DictionaryItemsSection.vue'
import {useDictionaryDialog} from '~/composables/admin/dictionaries/useDictionaryDialog'
const emit=defineEmits<{saved:[id:string]}>()
const {store,confirmation,editor,typeEditable,dialogTitle,createMode,metadataDirty,dirty,parsed,busy,detail,loading,loadError,toast,requestClose,saveType}=useDictionaryDialog(id=>emit('saved',id))
</script>
<template>
  <AdminCommonDialog :open="editor.open" :title="dialogTitle"
                     :description="detail ? '维护字典资料和选项；类型与全部选项共享更新版本。' : '先创建字典类型，再添加具体选项。'"
                     :busy="busy" size="large" @close="requestClose">
    <AdminCommonDataState v-if="loading" state="loading" title="正在加载字典…"/>
    <AdminCommonFeedback v-else-if="loadError" title="字典加载失败">{{ loadError }}</AdminCommonFeedback>
    <div v-else class="dictionary-dialog-body">
      <DictionaryTypeForm @save="saveType"/>

      <DictionaryItemsSection @saved="emit('saved', $event)"/>
    </div>
    <template #actions>
      <UButton class="admin-button" :disabled="busy" @click="requestClose">{{ dirty ? '取消' : '关闭' }}</UButton>
      <UButton v-if="!loading && !loadError && typeEditable" form="dictionary-type-form" type="submit"
               class="admin-button admin-button-primary"
               :disabled="busy || (createMode ? parsed.success === false : !metadataDirty)">
        {{ busy ? '处理中…' : createMode ? '创建字典' : '保存基本信息' }}
      </UButton>
    </template>
  </AdminCommonDialog>
    <AdminCommonToast :notification="toast?{message:toast.message,tone:toast.status}:null" @dismiss="store.editor.feedback = null"/>
  <AdminCommonConfirmDialog :confirmation="confirmation.state.value" @settle="confirmation.settle"/>
</template>

<style src="~/assets/admin/css/pages/dictionaries.css"></style>
