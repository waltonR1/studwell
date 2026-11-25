<script setup lang="ts">
import TemplateBusinessBadges from './pages/TemplateBusinessBadges.vue'
import {templateBusinessModules} from '~/utils/admin/website/template-business'
import PreviewDialog from '~/components/admin/preview/PreviewDialog.vue'
import '~/assets/admin/css/components/website-editor.css'
import {Search,ArrowUpRight,Eye,Trash2} from 'lucide-vue-next'
import {adminMediaFileUrl} from '~/api/admin/media'
import {companyBrand} from '~/config/admin/brand'
import {storeToRefs} from 'pinia'
import {useAdminWebsiteTemplatesStore} from '~/stores/admin/website-templates'
import {useAdminSessionStore} from '~/stores/admin/session'
import {useAdminRefresh,useAdminBusy} from '~/composables/admin/navigation/useAdminRefresh'
import {useAdminToast} from '~/composables/admin/interaction/useAdminToast'
import {useAdminActionConfirm} from '~/composables/admin/interaction/useAdminActionConfirm'
import {useAdminUnsavedGuard} from '~/composables/admin/forms/useAdminUnsavedGuard'
import ConfigurationDialog from './templates/ConfigurationDialog.vue'
import {useTemplateConfiguration} from '~/composables/admin/website/useTemplateConfiguration'
import MetadataDialog from './templates/MetadataDialog.vue'
useHead({title:`区块模板 | ${companyBrand.name}`})
const store=useAdminWebsiteTemplatesStore(),session=useAdminSessionStore(),{items,pending,saving,error,draft,dirty}=storeToRefs(store),toast=useAdminToast(),confirmation=useAdminActionConfirm()
useAdminBusy(()=>store.saving)
const search=ref(''),appliedSearch=ref(''),source=ref(''),appliedSource=ref('')
const sourceKey=(item:typeof items.value[number])=>item.definition ? item.definition.category ?? 'uncategorized' : 'unregistered'
const sourceName=(key:string)=>key==='unregistered'?'历史遗留':key==='uncategorized'?'未分类':key
const sourceItems=computed(()=>[{value:'',label:'全部分类'},...[...new Set(items.value.map(sourceKey))].map(key=>({value:key,label:sourceName(key)}))])
const sourceLabel=(item:typeof items.value[number])=>sourceName(sourceKey(item))
function query(){appliedSearch.value=search.value.trim();appliedSource.value=source.value}
const preview=ref<{key:string;name:string;revision?:number|null}|null>(null)
const filteredItems=computed(()=>items.value.filter(item=>(!appliedSource.value||sourceKey(item)===appliedSource.value)&&(!appliedSearch.value||[item.key,item.name,item.description].join(' ').toLowerCase().includes(appliedSearch.value.toLowerCase()))))
const configuration=useTemplateConfiguration(confirmation,toast)
const guard=useAdminUnsavedGuard(()=>!!dirty.value||store.configurationDirty||!!configuration.json.value,'模板修改尚未保存。')
async function close(){if(dirty.value&&!await confirmation.ask({title:'放弃修改？',message:'模板资料尚未保存。',confirmLabel:'放弃修改',cancelLabel:'继续编辑'}))return;store.close()}
async function setEnabled(id:string,value:boolean){toast.dismiss();const result=await store.setEnabled(id,value);if(result)toast.show(result.message,result.status)}
async function save(){toast.dismiss();const result=await store.save();if(result)toast.show(result.message,result.status)}
async function removeTemplate(item:typeof items.value[number]){
 if(item.enabledForNew||!session.can('content.templates.update')||saving.value||draft.value)return
 if(!await confirmation.ask({title:'删除区块模板？',message:`“${item.name}”将被删除。仍有工作区块或发布历史引用时会阻止删除；媒体文件不会自动删除。`,confirmLabel:'删除',cancelLabel:'取消'}))return
 toast.dismiss();const result=await store.remove(item.id);if(result)toast.show(result.message,result.status)
}
useAdminRefresh(async()=>{store.close();store.closeConfiguration();await store.load();if(error.value)throw new Error(error.value)},async()=>!saving.value&&await guard.guard())
onBeforeRouteLeave(()=>!saving.value)
onBeforeUnmount(store.leave)
watch(()=>session.generation,toast.dismiss)
await callOnce('website-templates',store.load,{mode:'navigation'})
</script>
<template>
 <section class="admin-module admin-view-page admin-view-list">
  <AdminCommonPageHeader title="区块模板" description="登记已部署组件，维护模板资料及配置修订。禁用后不能新装配，已有区块和发布历史保留。"><template #actions><UButton v-if="session.can('content.templates.update')" class="admin-button admin-button-primary" :disabled="saving||pending||!!draft||!!store.configuration" @click="store.configure()">登记模板</UButton></template></AdminCommonPageHeader>
  <AdminCommonToast :notification="toast.notification.value" @dismiss="toast.dismiss" /><AdminCommonConfirmDialog :confirmation="confirmation.state.value" @settle="confirmation.settle" />
  <section class="admin-view-list-card" aria-label="模板查询结果">
   <header class="admin-view-list-heading"><h2>模板列表 <span class="admin-view-result-count">{{ filteredItems.length }} 项</span></h2><p>资料维护列表信息，配置维护字段与修订。</p></header>
   <form class="admin-toolbar admin-filter-bar admin-view-filters" @submit.prevent="query">
    <div class="admin-view-search"><Search class="admin-view-search-icon" aria-hidden="true"/><UInput v-model="search" placeholder="搜索名称、代称或说明" aria-label="搜索名称、代称或说明" :maxlength="100" :ui="{base:'admin-input'}" /></div>
    <AdminCommonSelectField v-model="source" class="template-source-filter" label="模板分类筛选" :items="sourceItems" :disabled="pending" :body-lock="false" @change="query"/>
    <UButton type="submit" class="admin-button" :disabled="pending">查询</UButton>
   </form>
   <AdminCommonDataState v-if="pending" state="loading" title="正在加载模板…" />
   <AdminCommonDataState v-else-if="error" state="error" title="模板加载失败" :description="error"><template #action><UButton class="admin-button" @click="store.load">重试</UButton></template></AdminCommonDataState>
   <AdminCommonDataState v-else-if="!filteredItems.length" state="empty" title="没有找到模板" description="请调整查询条件。" />
   <AdminCommonTable v-else label="区块模板目录" :min-width="1100">
    <colgroup><col style="width:10%"><col style="width:18%"><col style="width:11%"><col style="width:9%"><col style="width:25%"><col style="width:27%"></colgroup>
    <thead><tr><th>封面</th><th>模板名称</th><th>模板分类</th><th class="admin-table-status">状态</th><th>说明</th><th class="admin-table-actions">操作</th></tr></thead>
    <tbody><tr v-for="item in filteredItems" :key="item.id">
     <td><img v-if="item.coverMediaId && session.can('content.media.read')" class="site-media-thumbnail" :src="adminMediaFileUrl(item.coverMediaId)" :alt="item.name" loading="lazy" /><span v-else>{{ item.coverMediaId ? '已设置封面' : '未设置封面' }}</span></td>
     <td><div class="template-catalog-name"><strong>{{ item.name }}</strong><code>{{ item.key }}</code></div><TemplateBusinessBadges :modules="templateBusinessModules(item)"/><AdminCommonStatusBadge v-if="!item.definition" tone="warning">历史保留</AdminCommonStatusBadge></td>
     <td>{{ sourceLabel(item) }}</td>
     <td class="admin-table-status"><div class="admin-switch-status"><AdminCommonSwitchField :model-value="item.enabledForNew" :label="item.name+'启用状态'" :disabled="saving||pending||!session.can('content.templates.update')||(!item.definition&&!item.enabledForNew)" @update:model-value="setEnabled(item.id,$event)"/><span>{{ item.enabledForNew ? '启用' : '禁用' }}</span></div></td>
     <td><p class="template-catalog-description">{{ item.description||'暂无说明' }}</p></td>
    <td class="admin-table-actions"><AdminCommonRowActions><UButton v-if="item.definition&&session.can('content.templates.update')" class="admin-button" :disabled="saving||!!draft||!!store.configuration" @click="store.configure(item.id)">配置</UButton><UButton v-if="item.definition" class="admin-button" data-tone="neutral" :disabled="saving" @click="preview={key:item.key,name:item.name,revision:item.revision}">预览<Eye class="admin-view-action-icon" aria-hidden="true"/></UButton><UButton v-if="!item.enabledForNew&&session.can('content.templates.update')" class="admin-button admin-button-danger" data-tone="danger" :disabled="saving||pending||!!draft" @click="removeTemplate(item)">删除<Trash2 class="admin-view-action-icon" aria-hidden="true"/></UButton><UButton class="admin-button admin-button-quiet" :disabled="saving" @click="store.edit(item.id)">{{ session.can('content.templates.update')?'资料':'查看' }}<ArrowUpRight class="admin-view-action-icon" aria-hidden="true"/></UButton></AdminCommonRowActions></td>
    </tr></tbody>
   </AdminCommonTable>
  </section>
  <MetadataDialog :can-edit="session.can('content.templates.update')" @close="close" @save="save" />
  <PreviewDialog :open="!!preview" :title="preview ? preview.name+' · 模板预览' : '模板预览'" :src="preview ? '/admin/template-preview/'+encodeURIComponent(preview.key) : undefined" description="使用已保存的模板样例，可切换设备查看。" @close="preview=null"><template #toolbar><span v-if="preview" class="template-preview-key">{{ preview.key }}</span><AdminCommonStatusBadge v-if="preview?.revision" tone="neutral">最新修订 {{ preview.revision }}</AdminCommonStatusBadge></template></PreviewDialog>
  <ConfigurationDialog v-model:json="configuration.json.value" @close="configuration.close" @save="configuration.save" @import-json="configuration.importJson" @import-file="configuration.importFile" @export-definition="configuration.exportDefinition" />
 </section>
</template>


<style scoped>
.template-source-filter { width:160px; }
.template-catalog-name { display:grid; gap:5px; min-width:0; }
.template-catalog-name strong { color:#334b64; font-size:13px; }
.template-catalog-name code { color:#7e8da0; font-size:11px; overflow-wrap:anywhere; }
.template-catalog-description { max-width:32ch; margin:0; color:#7a8a9d; font-size:12px; line-height:1.7; overflow-wrap:anywhere; }
.template-preview-key { color:#8190a3; font-family:monospace; font-size:12px; overflow-wrap:anywhere; }
</style>
