<script setup lang="ts" generic="T extends {id:string;name:string;visible:boolean}">
import {ADMIN_PAGE_SIZES, DEFAULT_ADMIN_PAGE_SIZE} from '#shared/config/admin/pagination'
import type {AdminListStatusLabels} from '~/types/admin/list'
const search=defineModel<string>('search',{required:true})
const visibility=defineModel<string>('visibility',{required:true})
const props = withDefaults(defineProps<{
 title:string; description:string; count:number; rows:T[]; label:string; nameLabel:string;
 createLabel:string; placeholder:string; emptyTitle:string; emptyDescription:string; note:string;
 writable:boolean; busy:boolean; filtered:boolean;
 showSearch?:boolean;showVisibility?:boolean;showOrder?:boolean;canCreate?:boolean;canDelete?:boolean;minWidth?:number;paginated?:boolean;
 statusLabels?:AdminListStatusLabels;
 depth?:(row:T)=>number; hasChildren?:(row:T)=>boolean; expanded?:(row:T)=>boolean;
 hiddenByParent?:(row:T)=>boolean; kind?:(row:T)=>string|undefined;
 canMove:(row:T,direction:'up'|'down')=>boolean
}>(),{showSearch:true,showVisibility:true,showOrder:true,minWidth:1100,canCreate:undefined,canDelete:undefined,depth:()=>0,hasChildren:()=>false,expanded:()=>false,hiddenByParent:()=>false,kind:()=>undefined})
const emit=defineEmits<{query:[];create:[];toggle:[row:T];move:[row:T,direction:'up'|'down'];visibility:[row:T,value:boolean];edit:[row:T];remove:[row:T]}>()
const page = ref(1)
const pageSize = ref(String(DEFAULT_ADMIN_PAGE_SIZE))
const pageSizes = ADMIN_PAGE_SIZES.map(size => ({label:size + ' 条', value:String(size)}))
const pageCount = computed(() => Math.max(1, Math.ceil(props.rows.length / Number(pageSize.value))))
const pageRows = computed(() => {
 const size = Number(pageSize.value)
 return props.paginated ? props.rows.slice((page.value - 1) * size, page.value * size) : props.rows
})
watch(pageCount, count => { page.value = Math.min(page.value, count) })
watch(pageSize, () => { page.value = 1 })
function query() {
 page.value = 1
 emit('query')
}
</script>
<template>
 <section class="admin-view-list-card" :aria-label="label">
  <header class="admin-view-list-heading"><h2>{{ title }} <span class="admin-view-result-count">{{ count }} 项</span></h2><p v-if="description">{{ description }}</p></header>
  <AdminCommonMenuTreeToolbar v-if="showSearch||showVisibility||(canCreate??writable)" :show-search="showSearch" :show-visibility="showVisibility" v-model:search="search" v-model:visibility="visibility" :placeholder="placeholder" :create-label="createLabel" :can-create="canCreate??writable" :disabled="busy" :status-labels="statusLabels" @search="query" @filter="query" @create="emit('create')"><template #actions><slot name="actions"/></template></AdminCommonMenuTreeToolbar>
  <slot name="feedback"/>
  <AdminCommonMenuTreeTable v-if="rows.length" :rows="pageRows" :label="label" :name-label="nameLabel"
   :show-order="showOrder" :show-visibility="showVisibility" :min-width="minWidth" :depth="depth" :has-children="hasChildren" :expanded="expanded" :hidden-by-parent="hiddenByParent" :kind="kind"
   :can-move="canMove" :writable="writable" :can-delete="canDelete??writable" :busy="busy" :filtered="filtered" :status-labels="statusLabels"
   @toggle="emit('toggle',$event)" @move="(row,direction)=>emit('move',row,direction)"
   @visibility="(row,value)=>emit('visibility',row,value)" @edit="emit('edit',$event)" @remove="emit('remove',$event)">
   <template v-if="$slots.columns" #columns><slot name="columns"/></template>
   <template #head><slot name="head"/></template>
   <template v-if="$slots.name" #name="{row}"><slot name="name" :row="row"/></template>
   <template #cells="{row}"><slot name="cells" :row="row"/></template>
   <template #actions="{row}"><slot name="row-actions" :row="row"/></template>
  </AdminCommonMenuTreeTable>
  <AdminCommonDataState v-else state="empty" :title="emptyTitle" :description="emptyDescription"/>
  <p v-if="rows.length&&note" class="admin-help admin-view-list-note">{{ note }}</p>
  <nav v-if="paginated" class="admin-toolbar admin-pagination" :aria-label="label + '分页'">
   <span>共 {{ rows.length }} 条，第 {{ page }} / {{ pageCount }} 页</span>
   <AdminCommonSelectField v-model="pageSize" class="admin-view-page-size" label="每页条数" :items="pageSizes" :disabled="busy" :body-lock="false"/>
   <UButton class="admin-button" :disabled="busy || page <= 1" @click="page--">上一页</UButton>
   <UButton class="admin-button" :disabled="busy || page >= pageCount" @click="page++">下一页</UButton>
  </nav>
 </section>
</template>
