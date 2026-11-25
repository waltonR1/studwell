<script setup lang="ts">
import {storeToRefs} from 'pinia'
import {useAdminWebsitePagesStore} from '~/stores/admin/website-pages'
import type {SiteLocale} from '#shared/schemas/admin/site-settings'
import type {PageContentActions} from '~/types/admin/website-maintenance'
const props=defineProps<{locale:SiteLocale;actions:PageContentActions}>()
const store=useAdminWebsitePagesStore()
const {record,busy,canDelete,dirty,assemblyEditorDirty}=storeToRefs(store)
const route=useRoute()
const hasUnsavedChanges=computed(()=>dirty.value||assemblyEditorDirty.value)
const {deleteOpen,openDeletion,permanentlyRemove,remove,closeAssemblyEditor}=props.actions
async function editContent(id:string) {
 if(id.startsWith('new_')) {props.actions.toast.show('请先保存页面草稿，再编辑新增区块的内容。','warning');return}
 await navigateTo(`/admin/website/${route.params.code}/sections/${id}`)
}
</script>
<template>
 <template v-if="record">
<AdminWebsitePagesSettingsForm :locale="locale"/>
            <AdminWebsitePagesSectionAssembly :locale="locale" @remove="remove" @edit="editContent" @close-editor="closeAssemblyEditor"/>

      <section v-if="canDelete" class="admin-section website-card">
        <h2>永久删除页面</h2>
        <p>删除页面设置、全部区块、草稿、发布历史及对应菜单，同时清理该菜单的角色授权。媒体库原文件和操作审计保留。</p>
        <p v-if="record.publication.publishedReleaseId" class="admin-help">请先下线页面，再执行永久删除。</p>
        <p v-else-if="hasUnsavedChanges" class="admin-help">请先保存或放弃未保存修改。</p>
        <div>
          <UButton class="admin-button admin-button-danger" data-tone="danger"
                   :disabled="busy||hasUnsavedChanges||!!record.publication.publishedReleaseId" @click="openDeletion">永久删除页面
          </UButton>
        </div>
      </section>
    <AdminWebsitePagesDeleteDialog :open="deleteOpen" @close="deleteOpen=false" @confirm="permanentlyRemove"/>

 </template>
</template>
