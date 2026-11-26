<script setup lang="ts">
import {type SiteLocale} from '#shared/schemas/admin/site-settings'
import {siteLocaleNames} from '#shared/config/admin/site-settings'
import type {useRouteMaintenance} from '~/composables/admin/website/useRouteMaintenance'

const {editor}=defineProps<{editor:ReturnType<typeof useRouteMaintenance>['contentProps']['value']['editor']}>()
const {tree,editLocales,form,editorOpen,busy,error,target,dynamicRoute,seoLocale,seoEntry,seoTarget,sorted,collapsed,onlineByNode,treeRows,targetLabels,toggleNode,proposed,changed,pendingRemovals,routeStatus,setRouteEnabled,select,save,remove,closeEditor}=editor
const localeOptions=(locales:SiteLocale[])=>locales.map(value=>({value,label:siteLocaleNames[value]}))
const parentOptions=computed(()=>[{value:'',label:'顶层'},...sorted.value.filter(node=>node.id!==form.value.id).map(node=>({value:node.id,label:node.path}))])
const pageOptions=computed(()=>tree.value.pages.map(page=>({value:page.id,label:page.key+(page.published?'':'（内容未发布）')})))
const targetOptions=Object.entries(targetLabels).map(([value,label])=>({value,label}))
</script>

<template>
   <section class="admin-section"><h2>路由树</h2>
    <p class="admin-help">启停设置保存为草稿，发布后生效。停用保留路径与 SEO，不影响子路由；其他页面仍有引用时需先处理引用。</p>
    <AdminCommonMenuTreeTable v-if="treeRows.length" :rows="treeRows" label="路由树" name-label="草稿路径" :min-width="660"
     :show-visibility="false" :show-order="false" :depth="row=>row.depth" :has-children="row=>row.hasChildren"
     :expanded="row=>!collapsed.has(row.id)" :hidden-by-parent="()=>false" :can-move="()=>false"
     :writable="true" :can-delete="false" :busy="busy" :filtered="false"
     @toggle="row=>toggleNode(row.id)" @edit="select">
     <template #head><th>目标类型</th><th>公开路径</th><th>启用</th><th>状态</th></template>
     <template #cells="{row}"><td>{{ targetLabels[row.targetType] }}</td><td>{{ onlineByNode.get(row.id) ?? '—' }}</td><td><AdminCommonSwitchField v-if="row.targetType==='page'" :model-value="row.enabled!==false" :label="row.path+'启用路由'" :disabled="busy||editorOpen" @update:model-value="setRouteEnabled(row,$event)"/><span v-else>—</span></td><td><AdminCommonStatusBadge v-if="row.targetType==='page'" :tone="routeStatus(row).startsWith('待')?'warning':routeStatus(row)==='已启用'?'success':'neutral'">{{ routeStatus(row) }}</AdminCommonStatusBadge><span v-else>—</span></td></template>
    </AdminCommonMenuTreeTable>
    <p v-else class="admin-help">暂无路由，请新建节点。</p>
    <p v-if="pendingRemovals.length">待下线：{{ pendingRemovals.map(row=>row.path).join('、') }}</p>
   </section>
   <AdminCommonDialog :open="editorOpen" :title="form.id ? '编辑路由' : '新增路由'" :busy="busy" @close="closeEditor">
    <div class="route-dialog-body">
     <AdminCommonFeedback v-if="error" tone="error">{{ error }}</AdminCommonFeedback>
     <form id="website-route-form" class="route-dialog-body" @submit.prevent="save">
     <section class="route-dialog-section">
      <h3>路由设置</h3>
      <div class="admin-fields admin-view-create-form route-dialog-fields">
        <label>父节点<AdminCommonSelectField v-model="form.parentId" label="父节点" :items="parentOptions" :disabled="busy" :body-lock="false"/></label>
        <AdminCommonTextField v-model="form.slug" label="路径段" :max="64" :disabled="busy" help="新闻详情子页可使用 :slug 作为最后一段，例如 /news/:slug。"/>
        <label>目标类型<AdminCommonSelectField label="目标类型" :model-value="form.targetType" :items="targetOptions" :disabled="busy" :body-lock="false" @update:model-value="form.targetType=$event as typeof form.targetType"/></label>
        <label v-if="form.targetType==='page'">所属页面<AdminCommonSelectField v-model="form.resourceId" label="所属页面" :items="pageOptions" :disabled="busy" :body-lock="false"/></label>
      </div>
      <div class="route-preview">
       <div>
        <strong>路径预览</strong>
        <code v-if="proposed">{{ proposed }}</code>
        <span v-else>请检查路径和目标</span>
       </div>
       <NuxtLink v-if="target && form.targetType==='page'" :to="'/admin/website/website_'+target.key" class="admin-button">维护页面内容</NuxtLink>
       <ul v-if="changed.length">
        <li v-for="node in changed" :key="node.id">{{ tree.draft.find(old=>old.id===node.id)?.path }} → {{ node.path }}</li>
       </ul>
      </div>
     </section>
     <p v-if="dynamicRoute" class="admin-help">详情页的 SEO 由每篇文章单独维护。</p>
     <section v-if="seoTarget && seoEntry" class="route-dialog-section">
      <header>
       <h3>页面 SEO</h3>
       <p class="admin-help">页面 · {{ target?.key }}。路由和 SEO 一起保存为草稿，发布后生效。切换目标会加载该页面已保存的 SEO。</p>
      </header>
      <div class="admin-fields admin-view-create-form route-dialog-fields route-seo-controls">
        <label>SEO 语言<AdminCommonSelectField label="SEO 语言" :model-value="seoLocale" :items="localeOptions(editLocales)" :disabled="busy" :body-lock="false" @update:model-value="seoLocale=$event as SiteLocale"/></label>
        <AdminCommonSwitchField v-model="seoEntry.indexable" label="允许搜索引擎索引" layout="row" :disabled="busy"/>
      </div>
      <section class="route-dialog-group">
       <h4>搜索结果</h4>
       <div class="admin-fields route-dialog-fields">
        <AdminCommonTextField v-model="seoEntry.title" label="SEO 标题" :max="200" :disabled="busy"/>
        <AdminCommonTextField v-model="seoEntry.description" label="搜索描述" :max="500" :disabled="busy" multiline :rows="3"/>
       </div>
      </section>
      <section class="route-dialog-group">
       <h4>社交分享</h4>
       <div class="admin-fields route-dialog-fields">
        <AdminCommonTextField v-model="seoEntry.ogTitle" label="OG 标题" :max="200" :disabled="busy"/>
        <AdminCommonTextField v-model="seoEntry.ogDescription" label="OG 描述" :max="500" :disabled="busy" multiline :rows="3"/>
        <AdminMediaPicker :key="JSON.stringify(seoTarget)+seoLocale" :field="'route-seo-'+JSON.stringify(seoTarget)+'-'+seoLocale" v-model="seoEntry.ogMediaId" label="OG 分享图片" kind="image" :disabled="busy"/>
       </div>
      </section>
     </section>
     </form>
    </div>
   <template #actions>
    <UButton v-if="form.id" class="admin-button admin-button-danger" :disabled="busy" @click="remove">删除节点</UButton>
    <UButton class="admin-button" :disabled="busy" @click="closeEditor">关闭</UButton>
    <UButton type="submit" form="website-route-form" class="admin-button admin-button-primary" :disabled="busy||!proposed">保存草稿</UButton>
   </template>
   </AdminCommonDialog>
</template>

<style scoped>
.route-language-options {
 display: grid;
 grid-template-columns: repeat(auto-fit, minmax(min(100%, 170px), 1fr));
 gap: 8px;
}

.route-language-save {
 justify-self: start;
}

.route-dialog-body,
.route-dialog-section,
.route-dialog-group {
 display: grid;
 gap: 16px;
 min-width: 0;
}

.route-dialog-body {
 gap: 24px;
}

.route-dialog-section h3,
.route-dialog-section h4,
.route-dialog-section p,
.route-preview ul {
 margin: 0;
}

.route-dialog-section h3 {
 font-size: 16px;
 font-weight: 700;
}

.route-dialog-group h4 {
 font-size: 14px;
 font-weight: 600;
}

.route-dialog-group,
.route-dialog-section + .route-dialog-section {
 border-top: 1px solid #e1e8f1;
 padding-top: 16px;
}

.route-dialog-body .route-dialog-section .route-dialog-fields {
 max-width: none;
 padding: 0;
}

.route-dialog-body .route-dialog-section .route-seo-controls {
 align-items: end;
}

.route-dialog-group {
 gap: 10px;
}

.route-preview {
 display: flex;
 flex-wrap: wrap;
 align-items: center;
 justify-content: space-between;
 gap: 10px;
 padding: 12px;
 border-radius: 8px;
 background: #f5f7fa;
 overflow-wrap: anywhere;
}

.route-preview strong {
 margin-inline-end: 8px;
}

.route-preview ul {
 flex-basis: 100%;
 padding-inline-start: 20px;
}

</style>
