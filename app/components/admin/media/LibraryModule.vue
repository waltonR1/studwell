<!-- 媒体库列表、预览和编辑展示，操作编排由 useMediaLibraryManagement 提供。 -->
<script setup lang="ts">
import VideoThumbnail from './VideoThumbnail.vue'
import MediaReferences from './MediaReferences.vue'
import {groupMediaReferences} from '~/utils/admin/media/references'
import {formatBeijingTime} from '#shared/utils/beijing-time'
import {Search,Eye,ArrowUpRight,Trash2} from 'lucide-vue-next'
import {ADMIN_PAGE_SIZES} from '#shared/config/admin/pagination'
import {MEDIA_MAX_BYTES,VIDEO_MAX_BYTES} from '#shared/config/admin/media'
import {adminMediaFileUrl} from '~/api/admin/media'
import ConfirmDialog from '~/components/admin/common/ConfirmDialog.vue'
import {useAdminPreferencesStore} from '~/stores/admin/preferences'
import {useAdminSessionStore} from '~/stores/admin/session'
import {useMediaLibraryManagement} from '~/composables/admin/media/useMediaLibraryManagement'
const session=useAdminSessionStore(),preferences=useAdminPreferencesStore(),pageRoute=useRoute()
const actorId=session.session?.user?.id??'anonymous'
await callOnce(`admin-preferences:${session.generation}:${actorId}:${pageRoute.path}`,()=>preferences.load(actorId),{mode:'navigation'})
const {store,confirmation,busy,list,preview,mediaRows,deletionById,selected,deleting,selectable,allSelected,toggleAll,sync,upload,edit,close,remove,removeSelected,ready}=useMediaLibraryManagement()
await ready
</script>
<template>
  <section class="admin-module admin-view-page admin-view-list media-library">
    <AdminCommonPageHeader title="媒体库" description="集中管理图片和视频，上传后补充名称与备注。"/>
    <AdminCommonToast :notification="store.feedback?{message:store.feedback.message,tone:store.feedback.status}:null" @dismiss="store.feedback = null"/>

    <section class="admin-view-list-card" aria-label="媒体查询结果">
      <header class="admin-view-list-heading"><h2>媒体列表 <span class="admin-view-result-count">{{ store.result.total }} 项</span></h2><p id="media-upload-help">支持 JPEG、PNG、WebP、ICO 图片，单个不超过 {{ MEDIA_MAX_BYTES / 1024 / 1024 }} MiB；MP4 视频，单个不超过 {{ VIDEO_MAX_BYTES / 1024 / 1024 }} MiB。支持多文件上传。</p></header>
      <form class="admin-toolbar admin-filter-bar admin-view-filters" @submit.prevent="list.submitSearch">
        <div class="admin-view-search"><Search class="admin-view-search-icon" aria-hidden="true"/><UInput v-model="list.draft.search" aria-label="媒体名称" placeholder="搜索媒体名称" :maxlength="100" :ui="{base: 'admin-input'}"/></div>
        <AdminCommonSelectField v-model="list.draft.filter" label="文件类型" :disabled="busy || store.pending" :items="[{label:'全部类型',value:''},{label:'图片',value:'image'},{label:'视频',value:'video'}]" @change="list.applyFilter"/>
        <UButton class="admin-button" type="submit" :disabled="busy || store.pending">查询</UButton>
        <label v-if="session.can('content.media.create')" class="admin-button admin-button-primary admin-view-create-button media-upload-trigger">上传文件<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/x-icon,image/vnd.microsoft.icon,.ico,video/mp4" aria-describedby="media-upload-help" :disabled="busy" @change="upload"></label>
      </form>
      <div v-if="session.can('content.media.delete')" class="media-batch-toolbar">
        <span>已选 {{ selected.length }} 项（仅当前页）</span>
        <UButton class="admin-button admin-button-danger" data-tone="danger" :disabled="!selected.length || busy || store.pending" @click="removeSelected()">删除所选</UButton>
        <UButton class="admin-button" :disabled="!selected.length || busy || store.pending" @click="selected = []">取消选择</UButton>
      </div>
      <AdminCommonDataState v-if="store.loadError" state="error" title="媒体列表加载失败" :description="store.loadError"><template #action><UButton class="admin-button" @click="sync()">重试</UButton></template></AdminCommonDataState>
      <AdminCommonDataState v-if="store.pending && !deleting && !store.result.items.length && !store.uploads.length" state="loading" title="正在加载媒体…"/>
      <AdminCommonDataState v-else-if="!deleting && !store.loadError && !store.result.items.length && !store.uploads.length" state="empty" title="暂无符合条件的媒体"/>
      <AdminCommonTable v-else-if="deleting || store.result.items.length || store.uploads.length" :min-width="1000" label="媒体列表" :aria-busy="store.pending">
        <colgroup><col v-if="session.can('content.media.delete')" style="width:48px"><col style="width:10%"><col style="width:20%"><col style="width:10%"><col style="width:10%"><col style="width:12%"><col style="width:10%"><col style="width:16%"></colgroup>
        <thead><tr><th v-if="session.can('content.media.delete')" class="media-select-cell"><input type="checkbox" aria-label="全选当前页可删除媒体" :checked="allSelected" :indeterminate="selected.length > 0 && !allSelected" :disabled="busy || store.pending || !selectable.length" @change="toggleAll"></th><th>预览图</th><th>媒体名称</th><th>类型</th><th class="admin-table-number">大小</th><th>尺寸</th><th>引用位置</th><th class="admin-table-actions">操作</th></tr></thead>
        <tbody>
          <template v-for="row in mediaRows" :key="row.key">
          <tr v-if="!row.record && row.upload" class="media-upload-row">
          <template v-for="uploadItem in [row.upload]" :key="uploadItem.id">
            <td v-if="session.can('content.media.delete')"></td>
            <td><span class="media-upload-placeholder">{{ uploadItem.file.type === 'video/mp4' ? '视频' : '图片' }}</span></td>
            <td><strong class="media-name">{{ uploadItem.file.name }}</strong><div class="media-upload-status" role="status">{{ uploadItem.state === 'waiting' ? '等待上传' : uploadItem.state === 'uploading' ? '上传中 ' + uploadItem.progress + '%' : uploadItem.state === 'success' ? '已上传，正在同步列表' : '上传失败' }}</div><progress v-if="uploadItem.state === 'uploading' || uploadItem.state === 'waiting'" :value="uploadItem.progress" max="100" :aria-label="uploadItem.file.name + ' 上传进度'"/><span v-if="uploadItem.error" class="media-upload-error">{{ uploadItem.error }}</span></td>
            <td>{{ uploadItem.file.type === 'video/mp4' ? 'MP4 视频' : '图片' }}</td>
            <td class="admin-table-number">{{ (uploadItem.file.size / 1024).toFixed(0) }} KB</td><td>—</td><td>—</td>
            <td class="admin-table-actions"><AdminCommonRowActions v-if="uploadItem.state === 'failed'">
              <UButton class="admin-button" :disabled="busy" @click="store.retryUpload(uploadItem.id)">重试</UButton>
              <UButton class="admin-button" :disabled="busy" @click="store.removeFailedUpload(uploadItem.id)">移除</UButton>
            </AdminCommonRowActions><UButton v-else-if="uploadItem.state === 'success' && store.loadError" class="admin-button" :disabled="busy || store.pending" @click="sync()">刷新列表</UButton></td>
          </template>
          </tr>
          <tr v-else-if="row.record">
          <template v-for="{item, deletion} in [{item: row.record, deletion: deletionById.get(row.record.id)}]" :key="item.id">
          <td v-if="session.can('content.media.delete')" class="media-select-cell" :title="item.references.length ? '被引用的媒体不能删除' : ''"><input v-model="selected" type="checkbox" :value="item.id" :aria-label="'选择' + item.name + (item.references.length ? '（被引用，不能删除）' : '')" :disabled="busy || store.pending || item.references.length > 0"></td>
          <td><button class="media-thumbnail" type="button" :aria-label="'预览'+item.name" :disabled="busy" @click="preview = item"><img v-if="item.kind==='image'" :src="adminMediaFileUrl(item.id)" alt="" loading="lazy"><VideoThumbnail v-else :key="item.id" :src="adminMediaFileUrl(item.id)"/></button></td>
          <td>
            <strong class="media-name">{{ item.name }}</strong>
            <div role="status">
              <span v-if="deletion?.state === 'waiting' || deletion?.state === 'deleting'" class="media-upload-status">{{ deletion.state === 'waiting' ? '等待删除' : '删除中…' }}</span>
              <span v-else-if="deletion?.state === 'failed'" class="media-upload-error">删除失败：{{ deletion.error }}</span>
            </div>
          </td>
          <td>{{ item.kind==='image'?'图片':'MP4 视频' }}</td>
          <td class="admin-table-number">{{ (item.size/1024).toFixed(0) }} KB</td><td>{{ item.width ? `${item.width} × ${item.height}` : '—' }}</td>
          <td>{{ item.references.length ? groupMediaReferences(item.references).length+' 处' : '未引用' }}</td>
          <td class="admin-table-actions"><AdminCommonRowActions>
            <UButton class="admin-button admin-button-quiet" :disabled="busy" @click="edit(item)">{{ session.can('content.media.update')?'编辑':'查看' }}<ArrowUpRight v-if="session.can('content.media.update')" class="admin-view-action-icon" aria-hidden="true"/><Eye v-else class="admin-view-action-icon" aria-hidden="true"/></UButton>
            <UButton v-if="session.can('content.media.delete')" class="admin-button admin-button-danger" data-tone="danger" :disabled="busy || store.pending || deleting || item.references.length>0" @click="remove(item)"><Trash2 class="admin-view-action-icon" aria-hidden="true"/>{{ deletion?.state === 'failed' ? '重试删除' : '删除' }}</UButton>
          </AdminCommonRowActions></td>
          </template>
        </tr>
        </template></tbody>
      </AdminCommonTable>
      <div v-if="!store.loadError" class="admin-toolbar admin-pagination">
        <span>共 {{ store.result.total }} 项，第 {{ list.page.value }} 页</span>
        <AdminCommonSelectField v-model="list.draft.pageSize" label="每页条数" :disabled="busy || store.pending" :items="ADMIN_PAGE_SIZES.map(size => ({label:`${size} 条`,value:String(size)}))" @change="list.applyPageSize"/>
        <UButton class="admin-button" :disabled="list.page.value<=1 || store.pending || busy" @click="list.goToPage(list.page.value-1)">上一页</UButton>
        <UButton class="admin-button" :disabled="list.page.value*store.result.pageSize>=store.result.total || store.pending || busy" @click="list.goToPage(list.page.value+1)">下一页</UButton>
      </div>
    </section>
    <AdminCommonDialog :open="!!store.editor" title="媒体资料" :busy="busy" @close="close">
      <form v-if="store.editor" id="media-editor" class="media-form" @submit.prevent="store.save">
        <img v-if="store.editor.kind==='image'" :src="adminMediaFileUrl(store.editor.id)" :alt="store.editor.name" class="media-preview">
        <video v-if="store.editor.kind==='video'" :src="adminMediaFileUrl(store.editor.id)" controls preload="metadata" class="media-video"/>
        <AdminCommonFeedback v-if="store.error" tone="error">{{ store.error }}</AdminCommonFeedback>
        <fieldset :disabled="busy || !session.can('content.media.update')">
          <label>名称<input v-model="store.editor.name" class="admin-input" required maxlength="160"></label>
          <label>备注<textarea v-model="store.editor.remark" class="admin-input" maxlength="1000" rows="3"/></label>
        </fieldset>
        <p>原文件：{{ store.editor.originalName }}</p>
        <p>类型：{{ store.editor.mime }} · 大小：{{ (store.editor.size / 1024).toFixed(0) }} KB<span v-if="store.editor.width"> · {{ store.editor.width }} × {{ store.editor.height }}</span></p>
        <p>上传人：{{ store.editor.createdByName }} · 上传时间：{{ formatBeijingTime(store.editor.createdAt, 'minute') }}</p>
        <MediaReferences :references="store.editor.references"/>

      </form>
      <template #actions><UButton class="admin-button" :disabled="busy" @click="close">关闭</UButton><UButton v-if="session.can('content.media.update')" type="submit" form="media-editor" class="admin-button admin-button-primary" :disabled="busy || !store.dirty">保存资料</UButton></template>
    </AdminCommonDialog>
    <AdminCommonDialog :open="!!preview" :title="preview?.name || '媒体预览'" @close="preview = null">
      <template v-if="preview">
        <img v-if="preview.kind === 'image'" :key="preview.id" :src="adminMediaFileUrl(preview.id)" :alt="preview.name" class="media-preview-only">
        <video v-else :key="preview.id" :src="adminMediaFileUrl(preview.id)" controls preload="metadata" class="media-preview-only media-preview-player"/>
      </template>
      <template #actions><UButton class="admin-button" @click="preview = null">关闭</UButton></template>
    </AdminCommonDialog>
    <ConfirmDialog :confirmation="confirmation.state.value" @settle="confirmation.settle"/>
  </section>
</template>
<style scoped src="~/assets/admin/css/pages/media.css"></style>
