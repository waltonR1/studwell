<script setup lang="ts" generic="T extends {id: string; name: string; visible: boolean}">
import {ArrowUp, ArrowDown, ArrowUpRight, Trash2} from 'lucide-vue-next'
import type {AdminListStatusLabels} from '~/types/admin/list'
withDefaults(defineProps<{
  showVisibility?:boolean
  showOrder?:boolean
  minWidth?:number
  rows: T[]
  label: string
  nameLabel?: string
  depth: (row: T) => number
  hasChildren: (row: T) => boolean
  expanded: (row: T) => boolean
  hiddenByParent: (row: T) => boolean
  canMove: (row: T, direction: 'up' | 'down') => boolean
  kind?: (row: T) => string | undefined
  writable: boolean
  canDelete: boolean
  busy: boolean
  filtered: boolean
  hideDisabledReason?: (row:T)=>string|undefined
  deleteDisabledReason?: (row:T)=>string|undefined
  statusLabels?:AdminListStatusLabels
}>(), {showVisibility:true,showOrder:true,minWidth:1100,nameLabel: '菜单名称', kind: () => undefined})
const emit = defineEmits<{
  toggle: [row: T]
  move: [row: T, direction: 'up' | 'down']
  visibility: [row: T, visible: boolean]
  edit: [row: T]
  remove: [row: T]
}>()
</script>
<template>
  <AdminCommonTable :min-width="minWidth" :label="label">
    <slot name="columns"/>
    <thead><tr><th>{{ nameLabel }}</th><slot name="head"/><th v-if="showOrder" class="admin-table-center">排序</th><th v-if="showVisibility" class="admin-table-status">{{ statusLabels?.column??'显示状态' }}</th><th class="admin-table-actions">操作</th></tr></thead>
    <tbody><tr v-for="row in rows" :key="row.id">
      <td><div class="menu-tree-name" :style="{paddingLeft: `${depth(row) * 20}px`}">
        <button v-if="hasChildren(row)" type="button" class="admin-tree-toggle" :aria-label="(expanded(row) ? '折叠' : '展开') + row.name" :aria-expanded="expanded(row)" :disabled="filtered" @click="emit('toggle', row)">{{ expanded(row) ? '▾' : '▸' }}</button>
        <span v-else class="menu-tree-toggle-spacer" aria-hidden="true"/>
        <slot name="name" :row="row"><strong>{{ row.name }}</strong></slot>
        <small v-if="kind(row)" class="admin-tree-kind">{{ kind(row) }}</small>
      </div></td>
      <slot name="cells" :row="row"/>
      <td v-if="showOrder" class="admin-table-center"><div class="menu-order-actions">
        <UButton class="admin-button" :aria-label="'上移' + row.name" :disabled="busy || !writable || !canMove(row, 'up') || filtered" @click="emit('move', row, 'up')"><ArrowUp aria-hidden="true"/>上移</UButton>
        <UButton class="admin-button" :aria-label="'下移' + row.name" :disabled="busy || !writable || !canMove(row, 'down') || filtered" @click="emit('move', row, 'down')"><ArrowDown aria-hidden="true"/>下移</UButton>
      </div></td>
      <td v-if="showVisibility" class="admin-table-status"><div class="admin-switch-status"><AdminCommonTooltip :text="row.visible ? hideDisabledReason?.(row) : undefined" :disabled-target="!!(row.visible && hideDisabledReason?.(row))"><AdminCommonSwitchField :model-value="row.visible" :label="row.name + (statusLabels?.column??'显示状态')" :disabled="busy || !writable || !!(row.visible && hideDisabledReason?.(row))" @update:model-value="emit('visibility', row, $event)"/></AdminCommonTooltip><span>{{ !row.visible ? statusLabels?.hidden??'已隐藏' : hiddenByParent(row) ? '上级已隐藏' : statusLabels?.visible??'显示' }}</span></div></td>
      <td class="admin-table-actions"><AdminCommonRowActions>
        <slot name="actions" :row="row"/>
        <UButton class="admin-button admin-button-quiet" :disabled="busy" @click="emit('edit', row)">{{ writable ? '编辑' : '查看' }}<ArrowUpRight class="admin-view-action-icon" aria-hidden="true"/></UButton>
        <AdminCommonTooltip v-if="canDelete" :text="deleteDisabledReason?.(row)" :disabled-target="!!deleteDisabledReason?.(row)"><UButton class="admin-button admin-button-danger" :disabled="busy || !!deleteDisabledReason?.(row)" data-tone="danger" @click="emit('remove', row)"><Trash2 class="admin-view-action-icon" aria-hidden="true"/>删除</UButton></AdminCommonTooltip>
      </AdminCommonRowActions></td>
    </tr></tbody>
  </AdminCommonTable>
</template>
<style scoped>
.menu-tree-name { display: flex; align-items: center; }
.menu-tree-toggle-spacer { flex: 0 0 32px; }
.menu-order-actions { display: flex; align-items: center; gap: 8px; }
.menu-order-actions { white-space: nowrap; }
.menu-order-actions :deep(svg) { width: 13px; height: 13px; }
.menu-order-actions :deep(.admin-button) { padding: 5px 7px; }
</style>
