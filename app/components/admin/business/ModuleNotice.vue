<script setup lang="ts">
import type {SiteModuleName} from '#shared/config/site-modules'
import {siteModuleCatalog,moduleManagementPath} from '#shared/config/site-modules'
import {useBusinessModuleStatus} from '~/composables/admin/useBusinessModuleStatus'
import {useAdminSessionStore} from '~/stores/admin/session'
import {useAdminRefresh} from '~/composables/admin/navigation/useAdminRefresh'
const props=defineProps<{module:SiteModuleName}>()
const session=useAdminSessionStore()
const {state,load,canRead}=useBusinessModuleStatus(()=>props.module)
useAdminRefresh(load)
onMounted(load)
watch([()=>session.generation,()=>props.module,canRead],()=>{void load()})
</script>

<template>
 <AdminCommonFeedback v-if="state&&!state.enabled" tone="warning">
  {{ siteModuleCatalog[module].name }}业务已停用，后台内容仍可维护。
  <NuxtLink v-if="session.isRoot" :to="moduleManagementPath">前往模块管理</NuxtLink>
  <span v-else>如需对外开放，请联系站点管理员。</span>
 </AdminCommonFeedback>
</template>
