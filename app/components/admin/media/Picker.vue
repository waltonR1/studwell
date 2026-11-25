<script setup lang="ts">
import {Upload,Search} from 'lucide-vue-next'
import {MEDIA_MAX_BYTES,VIDEO_MAX_BYTES} from '#shared/config/admin/media'
import {adminMediaFileUrl} from '~/api/admin/media'
import {useAdminSessionStore} from '~/stores/admin/session'
import {useAdminMediaSelectionStore} from '~/stores/admin/media-selection'

const props=defineProps<{field:string;kind?:'image'|'video'|'any';selectedKind?:'image'|'video';modelValue:string|null;label:string;disabled?:boolean}>()
const emit=defineEmits<{'update:modelValue':[value:string|null];select:[value:{id:string;kind:'image'|'video'}|null]}>()
const store=useAdminMediaSelectionStore(),session=useAdminSessionStore(),open=ref(false)
const selection=computed(()=>store.selection(props.field)),pageSize=store.pageSize
const mediaFilter=ref('')
const load=(page=1)=>store.load(props.field,page,props.kind==='any'?(mediaFilter.value==='image'?'image':mediaFilter.value==='video'?'video':'any'):props.kind)
const fileInput=ref<HTMLInputElement|null>(null),dialogFileInput=ref<HTMLInputElement|null>(null),uploadHelpId=useId()
const uploading=computed(()=>selection.value.uploading)
const imageAccept='image/jpeg,image/png,image/webp,image/x-icon,image/vnd.microsoft.icon,.ico'
const accept=computed(()=>props.kind==='any'?imageAccept+',video/mp4,.mp4':props.kind==='video'?'video/mp4,.mp4':imageAccept)
const uploadHelp=computed(()=>props.kind==='any'?'支持 JPEG、PNG、WebP、ICO 图片（不超过 '+MEDIA_MAX_BYTES/1024/1024+' MiB）及 MP4 视频（不超过 '+VIDEO_MAX_BYTES/1024/1024+' MiB）。':props.kind==='video'?'支持 MP4，单个不超过 '+VIDEO_MAX_BYTES/1024/1024+' MiB。':'支持 JPEG、PNG、WebP、ICO，单个不超过 '+MEDIA_MAX_BYTES/1024/1024+' MiB。')
function choose(id:string|null,kind:'image'|'video'='image'){
 if(props.disabled||uploading.value)return
 emit('update:modelValue',id)
 emit('select',id?{id,kind}:null)
 open.value=false
}
async function upload(event:Event){
 const input=event.target as HTMLInputElement,file=input.files?.[0]
 const slot=props.field,generation=session.generation
 if(file&&!props.disabled){const record=await store.upload(slot,file,props.kind);if(record&&!props.disabled&&slot===props.field&&generation===session.generation)choose(record.id,record.kind)}
 input.value=''
}
watch(open,value=>{if(!value)store.leave(props.field)})
watch(()=>props.field,(_field,previous)=>{store.leave(previous);open.value=false;mediaFilter.value=''})
watch(()=>session.generation,()=>{open.value=false})
watch(()=>props.disabled,disabled=>{if(disabled)open.value=false})
onBeforeUnmount(()=>store.leave(props.field))
</script>
<template>
 <div class="site-media">
  <input ref="fileInput" type="file" class="sr-only" :accept="accept" :aria-label="'上传'+label" :aria-describedby="uploadHelpId" :disabled="disabled||uploading||!session.can('content.media.create')||!session.can('content.media.read')" @change="upload"/>
  <span class="site-field-title">{{ label }}</span>
  <div class="site-media-current">
   <video v-if="(kind==='video'||selectedKind==='video')&&modelValue&&session.can('content.media.read')" :src="adminMediaFileUrl(modelValue)" controls preload="metadata"/>
   <img v-else-if="modelValue&&session.can('content.media.read')" :src="adminMediaFileUrl(modelValue)" :alt="label"/>
   <span v-else class="media-picker-placeholder">{{ modelValue?'已选择媒体':'尚未选择媒体' }}</span>
   <AdminCommonRowActions>
    <UButton class="admin-button" :disabled="disabled||uploading||!session.can('content.media.read')" @click="open=true;load()">从媒体库选择</UButton>
    <UButton v-if="session.can('content.media.create')&&session.can('content.media.read')" class="admin-button" :disabled="disabled||uploading" @click="fileInput?.click()"><Upload class="admin-view-action-icon" aria-hidden="true"/>{{ uploading?'上传中…':'上传' }}</UButton>
    <UButton v-if="modelValue" class="admin-button" :disabled="disabled||uploading" @click="choose(null)">清除</UButton>
   </AdminCommonRowActions>
  </div>
  <p v-if="!session.can('content.media.read')" class="admin-help">选择媒体需要查看媒体库权限。</p>
  <div :id="uploadHelpId" class="media-picker-guidance"><p>{{ uploadHelp }}</p><p v-if="session.can('content.media.create')">上传后直接选用，保存表单后绑定；文件保留在媒体库。</p></div>
  <p v-if="uploading" class="admin-help" role="status">正在上传：{{ selection.progress }}%</p>
  <AdminCommonFeedback v-if="selection.uploadError" tone="error">{{ selection.uploadError }}</AdminCommonFeedback>
  <Teleport v-if="open" to="#admin-main-content" defer>
   <div class="admin-module admin-view-page media-selection-dialog">
    <AdminCommonDialog :open="open" :title="'选择'+label" description="选择已有媒体，或上传一个文件后直接选用。" :busy="uploading" @close="open=false">
     <section class="admin-view-list-card" aria-label="媒体选择列表">
      <input ref="dialogFileInput" type="file" class="sr-only" :accept="accept" :aria-label="'上传'+label" :disabled="disabled||uploading||!session.can('content.media.create')" @change="upload"/>
      <form class="admin-toolbar admin-filter-bar admin-view-filters" @submit.prevent="load()">
       <div class="admin-view-search"><Search class="admin-view-search-icon" aria-hidden="true"/><UInput v-model="selection.search" :aria-label="'搜索'+label" placeholder="搜索媒体名称" :maxlength="100" :disabled="selection.pending||uploading" :ui="{base:'admin-input'}"/></div>
       <AdminCommonSelectField v-if="kind==='any'" v-model="mediaFilter" label="文件类型" :body-lock="false" :disabled="selection.pending||uploading" :items="[{label:'全部类型',value:''},{label:'图片',value:'image'},{label:'视频',value:'video'}]" @change="load()"/>
       <UButton type="submit" class="admin-button" :disabled="selection.pending||uploading">查询</UButton>
       <UButton v-if="session.can('content.media.create')" type="button" class="admin-button admin-button-primary admin-view-create-button" :disabled="disabled||uploading" @click="dialogFileInput?.click()"><Upload class="admin-view-button-icon" aria-hidden="true"/>{{ uploading?'上传中…':'上传文件' }}</UButton>
      </form>
      <p class="admin-help media-picker-help">{{ uploadHelp }}</p>
      <p v-if="uploading" class="admin-help media-picker-help" role="status">正在上传：{{ selection.progress }}%</p>
      <AdminCommonFeedback v-if="selection.uploadError" tone="error">{{ selection.uploadError }}</AdminCommonFeedback>
      <AdminCommonDataState v-if="selection.error" state="error" title="媒体加载失败" :description="selection.error"><template #action><UButton class="admin-button" :disabled="uploading" @click="load(selection.requestedPage)">重试</UButton></template></AdminCommonDataState>
      <AdminCommonDataState v-else-if="selection.pending && !selection.items.length" state="loading" title="正在加载媒体…"/>
      <AdminCommonDataState v-else-if="!selection.items.length" state="empty" title="没有找到媒体" description="可上传新文件，或调整查询条件。"/>
      <AdminCommonTable v-if="selection.items.length" label="可选择的媒体" :min-width="480">
       <colgroup><col style="width:140px"><col><col style="width:100px"></colgroup>
       <thead><tr><th>预览</th><th>媒体名称</th><th class="admin-table-actions">操作</th></tr></thead>
       <tbody><tr v-for="item in selection.items" :key="item.id">
        <td><AdminMediaVideoThumbnail v-if="item.kind==='video'" :src="adminMediaFileUrl(item.id)"/><img v-else class="site-media-thumbnail" :src="adminMediaFileUrl(item.id)" :alt="item.name" loading="lazy"/></td>
        <td class="media-picker-name">{{ item.name }}</td>
        <td class="admin-table-actions"><AdminCommonRowActions><UButton class="admin-button" :disabled="disabled||uploading||selection.pending" @click="choose(item.id,item.kind)">选择</UButton></AdminCommonRowActions></td>
       </tr></tbody>
      </AdminCommonTable>
     </section>
     <template #actions><div class="media-picker-pagination"><span>共 {{ selection.total }} 项 · 第 {{ selection.page }} / {{ Math.max(1,Math.ceil(selection.total/pageSize)) }} 页 <span role="status">{{ selection.pending && selection.items.length ? '· 正在加载…' : '' }}</span></span><UButton class="admin-button" :disabled="selection.pending||uploading||selection.page<=1" @click="load(selection.page-1)">上一页</UButton><UButton class="admin-button" :disabled="selection.pending||uploading||selection.page*pageSize>=selection.total" @click="load(selection.page+1)">下一页</UButton><UButton class="admin-button" :disabled="uploading" @click="open=false">关闭</UButton></div></template>
    </AdminCommonDialog>
   </div>
  </Teleport>
 </div>
</template>
<style scoped>
.site-media-current { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-top: 12px; }
.site-field-title { display: block; }
.site-media-current > img { width: 150px; height: 80px; object-fit: contain; }
.site-media-current > video { max-width: 100%; width: 320px; max-height: 180px; }
.site-media-thumbnail { width: 96px; height: 60px; object-fit: contain; }
.media-picker-placeholder { color: #778497; font-size: 13px; }
.media-picker-guidance { display: grid; gap: 4px; margin-top: 10px; color: #778497; font-size: 12px; line-height: 1.7; }
.media-picker-guidance p { margin: 0; }

.media-selection-dialog { display: contents; }
.admin-module.admin-view-page.media-selection-dialog :deep(.admin-dialog) { width: min(94vw,960px); z-index: 61; }
.admin-module.admin-view-page.media-selection-dialog :deep(.admin-overlay) { z-index: 60; }
.media-picker-help { padding: 0 20px 12px; }
.media-picker-name { overflow-wrap: anywhere; }
.media-picker-pagination { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 8px; width: 100%; }
.media-picker-pagination > span { margin-right: auto; font-size: 12px; }
</style>
