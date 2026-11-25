<!-- 导航树展示与筛选折叠；数据投影归 utils，草稿修改通过事件交给业务层。 -->
<script setup lang="ts">
import type {SiteSettings, SiteLocale, SiteLink} from '#shared/schemas/admin/site-settings'
import {siteNavigationRows} from '~/utils/admin/site-settings/navigation-rows'
import {filterMenuTree} from '~/utils/admin/menus/filter'

const props = defineProps<{
  section: 'header' | 'footer';
  header: SiteSettings['header'];
  footer: SiteSettings['footer'];
  locale: SiteLocale;
  disabled: boolean;
  busy?: boolean;
  targetName: (link: SiteLink) => string
}>()
const emit = defineEmits<{
  edit: [scope: 'header' | 'child' | 'footer', index: number, owner: number];
  group: [index: number];
  move: [list: unknown[], index: number, delta: number];
  remove: [list: unknown[], index: number];
  visibility: [list:unknown[],index:number,value:boolean]
}>()
const collapsed = ref<string[]>([]), search = ref(''), visibility = ref(''), appliedSearch = ref(''),
    appliedVisibility = ref('')

function query() {
  appliedSearch.value = search.value;
  appliedVisibility.value = visibility.value
}

const rows=computed(()=>filterMenuTree(siteNavigationRows(props.section,props.header,props.footer,props.locale,props.targetName),appliedSearch.value,appliedVisibility.value,collapsed.value))

function toggle(key: string) {
  collapsed.value = collapsed.value.includes(key) ? collapsed.value.filter(k => k !== key) : [...collapsed.value, key]
}

function setVisible(row: typeof rows.value[number], value: boolean) {
  if (props.disabled) return;
  emit('visibility',row.list,row.index,value)
}
</script>
<template>
  <AdminCommonTreeListEditor v-model:search="search" v-model:visibility="visibility"
    :title="section==='header'?'页头导航':'页脚链接'" description="维护导航层级与显示状态"
    :count="section==='header'?header.items.length:footer.groups.length" :rows="rows" label="导航列表" name-label="导航名称"
    placeholder="搜索导航名称" create-label="新增导航" :writable="!disabled" :busy="!!busy"
    empty-title="暂无匹配导航" empty-description="导航树不分页；筛选结果会保留父级以展示层级。"
    note="上移、下移仅调整同级导航；筛选时暂不可排序。修改保存为草稿后，需发布才更新发布版本。"
    :depth="row=>row.depth" :has-children="row=>row.hasChildren" :expanded="row=>!collapsed.includes(row.id)"
    :hidden-by-parent="row=>row.hiddenByParent" :kind="row=>row.scope==='group'?'分组':undefined"
    :can-move="(row,direction)=>direction==='up'?row.index>0:row.index<row.list.length-1" :filtered="!!appliedSearch||!!appliedVisibility"
    @query="query" @create="section==='header'?emit('edit','header',-1,0):emit('group',-1)" @toggle="row=>toggle(row.id)"
    @move="(row,direction)=>emit('move',row.list,row.index,direction==='up'?-1:1)" @visibility="setVisible"
    @edit="row=>row.scope==='group'?emit('group',row.index):emit('edit',row.scope,row.index,row.owner)" @remove="row=>emit('remove',row.list,row.index)">
      <template #head>
        <th>链接目标</th>
      </template>
      <template #name="{row}">
        <AdminCommonMenuIcon :icon-key="row.scope==='group'?'folder':'file-text'" class="menu-list-icon"/>
        <strong>{{ row.name }}</strong></template>
      <template #cells="{row}">
        <td>{{ row.target }}</td>
      </template>
  </AdminCommonTreeListEditor>
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
