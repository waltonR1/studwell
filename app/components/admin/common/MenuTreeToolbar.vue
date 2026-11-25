<script setup lang="ts">
import {Search, Plus} from 'lucide-vue-next'
import type {AdminListStatusLabels} from '~/types/admin/list'
const search = defineModel<string>('search', {required: true})
const visibility = defineModel<string>('visibility', {required: true})
withDefaults(defineProps<{showSearch?:boolean;showVisibility?:boolean;placeholder?: string; createLabel: string; canCreate: boolean; disabled: boolean;statusLabels?:AdminListStatusLabels}>(), {showSearch:true,showVisibility:true,placeholder: '搜索菜单名称或编码'})
const emit = defineEmits<{search: []; filter: []; create: []}>()
</script>
<template>
  <form class="admin-toolbar admin-filter-bar admin-view-filters" @submit.prevent="emit('search')">
    <div v-if="showSearch" class="admin-view-search"><Search class="admin-view-search-icon" aria-hidden="true"/><UInput v-model="search" :aria-label="placeholder" :placeholder="placeholder" :maxlength="100" :ui="{base: 'admin-input'}"/></div>
    <AdminCommonSelectField v-if="showVisibility" v-model="visibility" :body-lock="false" :label="statusLabels?.filter??'菜单显示筛选'" :items="[{label: '全部状态', value: ''}, {label: statusLabels?.visible??'显示', value: 'visible'}, {label: statusLabels?.hidden??'隐藏', value: 'hidden'}]" @change="emit('filter')"/>
    <UButton v-if="showSearch||showVisibility" type="submit" class="admin-button">查询</UButton>
    <slot name="actions"/>
    <UButton v-if="canCreate" type="button" class="admin-button admin-button-primary admin-view-create-button" :disabled="disabled" @click="emit('create')"><Plus class="admin-view-button-icon" aria-hidden="true"/>{{ createLabel }}</UButton>
  </form>
</template>
