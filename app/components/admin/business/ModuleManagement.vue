<script setup lang="ts">
import {siteModuleNames} from '#shared/config/site-modules'
import {companyBrand} from '~/config/admin/brand'
import {useAdminSessionStore} from '~/stores/admin/session'
import ModuleStatus from './ModuleStatus.vue'
import {useAdminToast} from '~/composables/admin/interaction/useAdminToast'
const session=useAdminSessionStore()
const refreshKey=ref(0)
const toast=useAdminToast()
watch(()=>session.generation,toast.dismiss)
if(!session.isRoot)throw createError({statusCode:403,statusMessage:'Forbidden'})
useHead({title:'模块管理 | '+companyBrand.name})
</script>

<template>
 <section class="admin-module admin-view-page admin-view-list">
  <AdminCommonPageHeader title="模块管理" description="按需开启官网业务，统一管理模块状态和页面引用。"/>
  <AdminCommonToast :notification="toast.notification.value" @dismiss="toast.dismiss"/>
  <section class="admin-section admin-view-panel module-management-list" aria-label="官网业务模块">
   <ModuleStatus v-for="module in siteModuleNames" :key="module" :module="module" :refresh-key="refreshKey" @changed="refreshKey++" @notify="toast.show($event.message,$event.tone)"/>
  </section>
 </section>
</template>

<style scoped>
.admin-module.admin-view-page > .module-management-list { padding: 0 24px; }
@media (max-width: 640px) {
 .admin-module.admin-view-page > .module-management-list { padding-inline: 16px; }
}
</style>
