<!-- 新闻管理界面装配；交互流程由 useNewsManagement 提供，业务状态由 store 持有。 -->
<script setup lang="ts">
import ModuleNotice from '~/components/admin/business/ModuleNotice.vue'
import {adminContentLocale} from '#shared/config/site-languages'
import {Search,Plus} from 'lucide-vue-next'
import EditorToolbar from '~/components/admin/website/shared/EditorToolbar.vue'
import {ADMIN_PAGE_SIZES} from '#shared/config/admin/pagination'
import ArticleEditorDialog from './ArticleEditorDialog.vue'
import CategoryEditorDialog from './CategoryEditorDialog.vue'
import PreviewDialog from '~/components/admin/preview/PreviewDialog.vue'
import {companyBrand} from '~/config/admin/brand'
import {useNewsManagement} from '~/composables/admin/news/useNewsManagement'
const props=defineProps<{mode:'articles'|'categories'}>()
const viewSettingsOpen=ref(false)
const {categoryEntries,appliedCategorySearch,appliedCategoryStatus,title,store,session,toast,confirmation,canEditArticle,canEditCategory,items,categories,categoryDirty,total,query,pending,busy,error,warning,saveError,draft,categoryDraft,release,dirty,operations,locale,preview,history,list,categoryFilter,categorySearch,categoryStatus,categoryRows,queryCategories,canMoveCategory,notify,close,action,cleanupRelease,setCategoryEnabled,deleteCategory,moveCategory,search}=useNewsManagement(props)
useHead({title:title+' | '+companyBrand.name})
</script>
<template>
 <section class="admin-module admin-view-page admin-view-list">
  <AdminCommonPageHeader :title="title" :description="mode==='articles'?'管理新闻编辑、预览、发布和历史版本。':'分类供文章、新闻列表和导航目标共同引用。'">
   <template #actions>
    <UButton v-if="mode==='articles'" class="admin-button" :disabled="pending||busy||!operations||!!error" @click="viewSettingsOpen=true">浏览量设置</UButton>
    <EditorToolbar v-if="mode==='categories'" v-model:locale="locale" class="news-toolbar" :dirty="categoryDirty" :disabled="busy||pending">
     <template #actions>
      <UButton v-if="canEditCategory" class="admin-button admin-button-primary" :disabled="busy||pending||!categoryDirty||!!categoryDraft" @click="notify(store.saveCategories())">保存</UButton>
     </template>
    </EditorToolbar>
   </template>
  </AdminCommonPageHeader>
  <ModuleNotice module="news"/>
  <AdminCommonToast :notification="toast.notification.value" @dismiss="toast.dismiss"/><AdminCommonConfirmDialog :confirmation="confirmation.state.value" @settle="confirmation.settle"/>
  <AdminCommonDialog v-if="mode==='articles'" :open="viewSettingsOpen" title="浏览量设置" size="medium" :busy="busy" @close="viewSettingsOpen=false">
   <AdminCommonFeedback v-if="saveError" tone="error">{{ saveError }}</AdminCommonFeedback>
   <div v-if="operations" class="site-fields">
    <div>
     <AdminCommonSwitchField layout="row" label="浏览量统计" :model-value="operations.viewCountEnabled" :busy="busy" :disabled="pending||!session.can('content.news.operations.update')" @update:model-value="notify(store.saveOperations($event))"/>
     <p class="site-help">修改立即保存并生效。关闭后暂停统计并隐藏前台数字，已有计数保留。</p>
    </div>
   </div>
   <template #actions><UButton class="admin-button" :disabled="busy" @click="viewSettingsOpen=false">关闭</UButton></template>
  </AdminCommonDialog>
  <div v-if="warning" class="news-list-freshness"><AdminCommonStatusBadge tone="warning">{{ warning }}</AdminCommonStatusBadge><span>当前列表可能不是最新数据，请使用右上角刷新。</span></div>
  <AdminCommonFeedback v-if="saveError&&!draft&&!categoryDraft&&!viewSettingsOpen" tone="error">{{ saveError }}</AdminCommonFeedback>
  <template v-if="mode==='categories'">
   <AdminCommonDataState v-if="pending" state="loading" title="正在加载新闻分类…"/>
   <AdminCommonDataState v-else-if="error" state="error" title="分类加载失败" :description="error"><template #action><UButton class="admin-button" @click="store.load()">重试</UButton></template></AdminCommonDataState>
   <AdminCommonTreeListEditor v-else v-model:search="categorySearch" v-model:visibility="categoryStatus"
    title="分类列表" description="在页面顶部切换语言。弹窗内确认修改后，点击页面顶部的保存使修改生效。" :count="categoryEntries.length" :rows="categoryRows" label="新闻分类" name-label="名称"
    create-label="新增分类" placeholder="搜索分类名称或编码" empty-title="暂无匹配分类" empty-description="请调整筛选条件或新增新闻分类。"
    :note="categoryDirty?'分类修改尚未保存。请在页面顶部保存后再调整顺序。':'上移、下移调整分类展示顺序；筛选时不可排序。'"
    :writable="session.can('content.news.categories.update')" :busy="busy||pending" :filtered="!!appliedCategorySearch||!!appliedCategoryStatus"
    :status-labels="{column:'启用状态',filter:'分类状态筛选',visible:'启用',hidden:'停用'}" :can-move="(row,direction)=>canMoveCategory(row.id,direction)"
    @query="queryCategories" @create="store.editCategory()" @edit="row=>store.editCategory(row.id)" @remove="row=>deleteCategory(row.id)"
    @visibility="(row,value)=>setCategoryEnabled(row.id,value)" @move="(row,direction)=>moveCategory(row.id,direction)">
    <template #columns><colgroup><col style="width:25%"><col style="width:20%"><col style="width:22%"><col style="width:15%"><col style="width:18%"></colgroup></template>
    <template #head><th>分类编码</th></template><template #cells="{row}"><td>{{ row.code }}</td></template>
   </AdminCommonTreeListEditor>
  </template>
  <section v-else class="admin-view-list-card" aria-label="新闻查询结果">
   <header class="admin-view-list-heading"><h2>文章列表 <span class="admin-view-result-count">{{ total }} 条</span></h2><p>按标题、分类和发布状态查找新闻</p></header>
   <form class="admin-toolbar admin-filter-bar admin-view-filters" @submit.prevent="search">
    <div class="admin-view-search"><Search class="admin-view-search-icon" aria-hidden="true"/><UInput v-model="list.draft.search" placeholder="搜索标题或链接标识" aria-label="搜索新闻" :maxlength="100" :ui="{base:'admin-input'}"/></div>
    <AdminCommonSelectField v-model="list.draft.filter" label="发布状态" :disabled="pending||busy" :items="[{value:'',label:'全部状态'},{value:'published',label:'已发布'},{value:'offline',label:'已下线'},{value:'unpublished',label:'未发布'}]" :body-lock="false" @change="search"/>
    <AdminCommonSelectField v-model="categoryFilter" label="分类筛选" :disabled="pending||busy" :items="[{value:'',label:'全部分类'},...categories.map(c=>({value:c.id,label:c.name[adminContentLocale]??c.code}))]" :body-lock="false" @change="search"/>
    <UButton type="submit" class="admin-button" :disabled="pending||busy">查询</UButton>
    <UButton v-if="mode==='articles'&&session.can('content.news.update')" class="admin-button admin-button-primary admin-view-create-button" :disabled="pending||busy" @click="store.edit()"><Plus class="admin-view-action-icon" aria-hidden="true"/>新增新闻</UButton>
   </form>
   <AdminCommonDataState v-if="pending" state="loading" title="正在加载新闻资料…"/><AdminCommonDataState v-else-if="error" state="error" title="加载失败" :description="error"><template #action><UButton class="admin-button" @click="store.load()">重试</UButton></template></AdminCommonDataState>
   <AdminCommonDataState v-else-if="!items.length" state="empty" title="暂无匹配新闻"/>
   <AdminCommonTable v-else label="新闻文章" :min-width="900"><thead><tr><th>标题</th><th>分类</th><th>日期</th><th class="admin-table-status">发布状态</th><th>首页推荐</th><th class="admin-table-number">浏览量</th><th class="admin-table-actions">操作</th></tr></thead><tbody><tr v-for="a in items" :key="a.id"><td><strong>{{ a.content.localized[adminContentLocale]?.title||'未填写标题' }}</strong><small class="news-slug">{{ a.slug }}</small></td><td>{{ categories.find(c=>c.id===a.content.categoryId)?.name[adminContentLocale] }}</td><td>{{ a.content.displayDate }}</td><td class="admin-table-status"><AdminCommonStatusBadge :tone="a.status==='published'?'success':'neutral'">{{ a.status==='published'?'已发布':a.status==='offline'?'已下线':'未发布' }}</AdminCommonStatusBadge><AdminCommonDraftBadge v-if="a.changed" :dirty="true">有未发布修改</AdminCommonDraftBadge></td><td>{{ a.content.featured?'推荐':'—' }}</td><td class="admin-table-number">{{ a.viewCount }}</td><td class="admin-table-actions"><AdminCommonRowActions>
    <UButton class="admin-button" :disabled="busy" @click="store.edit(a.id)">{{ canEditArticle?'编辑':'查看' }}</UButton>
    <template v-if="session.can('content.news.publish')">
     <UButton v-if="a.status==='published'" class="admin-button" :disabled="busy" @click="action(a,'withdraw')">下线</UButton>
     <UButton v-else-if="a.status==='offline'&&a.releases[0]&&!a.changed" class="admin-button" :disabled="busy" @click="action(a,'restore',a.releases[0].id,true)">发布</UButton>
     <UButton v-else class="admin-button" :disabled="busy||!a.changed" @click="action(a,'publish')">发布</UButton>
    </template>
    <UButton class="admin-button" :disabled="busy||!a.releases.length" @click="history=a">发布历史</UButton>
    <UButton v-if="session.can('content.news.delete')&&!a.releases.length" class="admin-button" data-tone="danger" :disabled="busy" @click="action(a,'delete')">删除</UButton>
   </AdminCommonRowActions></td></tr></tbody></AdminCommonTable>
   <div class="admin-toolbar admin-pagination">
    <span>共 {{ total }} 条，第 {{ list.page.value }} 页</span>
    <AdminCommonSelectField v-model="list.draft.pageSize" class="admin-view-page-size" label="每页条数" :items="ADMIN_PAGE_SIZES.map(size=>({label:size+' 条',value:String(size)}))" :disabled="pending||busy" :body-lock="false" @change="list.applyPageSize"/>
    <UButton class="admin-button" :disabled="pending||busy||list.page.value<=1" @click="list.goToPage(list.page.value-1)">上一页</UButton>
    <UButton class="admin-button" :disabled="pending||busy||list.page.value*query.pageSize>=total" @click="list.goToPage(list.page.value+1)">下一页</UButton>
   </div>
  </section>
  <ArticleEditorDialog v-model:locale="locale" v-model:draft="draft" :categories="categories" :busy="busy" :dirty="dirty" :save-error="saveError" :can-edit-article="canEditArticle" @close="close" @save="notify(store.save())" @preview="preview=true" />
  <CategoryEditorDialog v-model:draft="categoryDraft" :locale="locale" :busy="busy" :dirty="dirty" :save-error="saveError" :can-edit-category="canEditCategory" @close="close" @confirm="store.confirmCategory()" />
  <AdminCommonDialog :open="!!history&&!release" title="新闻发布历史" size="large" :busy="busy" @close="history=null"><AdminWebsiteSharedReleaseHistoryTable v-if="history" :releases="history.releases" :current-id="history.publishedReleaseId" :can-publish="false" view-label="预览" :can-cleanup="session.can('content.news.publish')" :busy="busy" @cleanup="cleanupRelease" @view="notify(store.viewRelease(history!,$event))" @restore="action(history!,'restore',$event)"/></AdminCommonDialog>
  <PreviewDialog :open="!!draft&&preview" src="/admin/news/article-preview" title="新闻草稿预览" :article="draft ? {content:draft.content,locale} : undefined" @close="preview=false" />
  <PreviewDialog :open="!!release" src="/admin/news/article-preview" title="新闻历史预览" :busy="busy" close-label="返回发布记录" :article="release ? {content:release.content,locale} : undefined" @close="store.release=null">
   <template #actions="{ready}"><UButton v-if="release&&!release.isCurrent&&history&&session.can('content.news.publish')" class="admin-button admin-button-primary" :disabled="busy||!ready" @click="action(history,'restore',release.id)">回滚到此版本</UButton></template>
  </PreviewDialog>
 </section>
</template>
<style scoped>
.news-toolbar { margin-bottom: 0; }
.news-slug { display: block; color: var(--admin-view-muted); margin-top: 6px; }
.news-list-freshness { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-block: 12px; color: var(--admin-view-muted); font-size: 12px; }
</style>
