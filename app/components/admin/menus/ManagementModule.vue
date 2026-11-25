<!-- 菜单管理展示，编辑与危险操作流程由 useMenuManagement 接线。 -->
<script setup lang="ts">
import MenuEditorDialog from './MenuEditorDialog.vue'
import {describeMenu} from '~/utils/admin/menus/tree'
import {useMenuManagement} from '~/composables/admin/menus/useMenuManagement'
const {auth,store,menus,pages,pending,loadError,catalogError,warning,busy,toast,confirmation,listQuery,search,visibility,displayed,branchExpanded,toggleBranch,depth,neighbor,openEditor,createWebsite,closeEditor,quickUpdate,move,remove,saveEditor,ready}=useMenuManagement()
await ready
</script>
<template>
  <section class="admin-module admin-view-page admin-view-list authorization-menu-management">
    <AdminCommonToast :notification="toast?{message:toast.message,tone:toast.status}:null" @dismiss="store.feedback = null"/>
    <AdminCommonPageHeader title="菜单管理"
                           description="管理后台菜单的名称、层级、顺序和显示状态；隐藏菜单不影响已分配的功能权限。">
      <template #actions><UButton v-if="auth.can('system.menus.create') && pages?.some(page=>page.key==='website_page' && page.grantable)" class="admin-button" :disabled="busy||!menus" @click="createWebsite">新建官网页面</UButton></template>
    </AdminCommonPageHeader>
    <section class="admin-view-list-card" aria-label="菜单查询结果">
      <header class="admin-view-list-heading"><h2>菜单列表 <span class="admin-view-result-count">{{
          menus?.length ?? 0
        }} 项</span></h2>
        <p>维护后台导航层级与显示状态</p></header>
      <AdminCommonMenuTreeToolbar v-model:search="search" v-model:visibility="visibility" create-label="新增菜单" :can-create="auth.can('system.menus.create')" :disabled="busy || !!loadError || !!catalogError || !menus || !pages" @search="listQuery.submitSearch" @filter="listQuery.applyFilter" @create="openEditor(null)"/>
      <AdminCommonFeedback v-if="warning" tone="warning">{{ warning }}</AdminCommonFeedback>
      <AdminCommonDataState v-if="pending" state="loading" title="正在加载菜单…"/>
      <AdminCommonDataState v-else-if="loadError || catalogError" state="error" title="菜单数据不完整"
                            description="菜单列表或页面目录尚未加载，请使用顶部刷新按钮重试。"/>
      <AdminCommonDataState v-else-if="!displayed.length" state="empty" title="暂无匹配菜单"
                            description="菜单树不分页；筛选结果会保留父级以展示层级。"/>
      <template v-else>
        <AdminCommonMenuTreeTable
          :rows="displayed" label="菜单列表" :depth="depth"
          :has-children="row => !!menus?.some(item => item.parentId === row.id)"
          :expanded="row => branchExpanded(row.id)"
          :hidden-by-parent="row => describeMenu(row, menus ?? []).hiddenByParent"
          :can-move="(row, direction) => !!neighbor(row, direction)"
          :kind="row => !row.pageKey ? '目录' : undefined"
          :writable="auth.can('system.menus.update')" :can-delete="auth.can('system.menus.delete')"
          :hide-disabled-reason="row=>row.hideDisabledReason" :delete-disabled-reason="row=>row.deleteDisabledReason"
          :busy="busy" :filtered="!!listQuery.applied.value.search || !!listQuery.applied.value.filter"
          @toggle="row => toggleBranch(row.id)" @move="move" @visibility="quickUpdate" @edit="openEditor" @remove="remove"
        >
          <template #head><th>编码</th><th>页面绑定</th></template>
          <template #name="{row}">
            <AdminCommonMenuIcon :icon-key="row.iconKey" class="menu-list-icon"/>
            <AdminCommonTooltip :text="describeMenu(row, menus ?? []).path" focusable><strong>{{ row.name }}</strong></AdminCommonTooltip>
          </template>
          <template #cells="{row}"><td>{{ row.code }}</td><td>{{ row.pageKey ? pages?.find(page => page.key === row.pageKey)?.name ?? '目录已废弃' : '目录' }}</td></template>
        </AdminCommonMenuTreeTable>
        <p class="admin-help admin-view-list-note">
          上移、下移仅调整同级菜单；筛选时暂不可排序，请清除筛选后操作。新增菜单默认位于所选层级末尾。</p>
      </template>
    </section>
    <MenuEditorDialog @close="closeEditor" @save="saveEditor"/>
    <AdminCommonConfirmDialog :confirmation="confirmation.state.value" @settle="confirmation.settle"/>
  </section>
</template>


<style scoped>
.menu-list-icon {
  flex: 0 0 16px;
  width: 16px;
  height: 16px;
  margin-inline-end: 8px;
  color: #6b83a0;
}

</style>
