<!-- 后台菜单路由装配，页面路径静态定义。 -->
<script setup lang="ts">
import {companyBrand} from '~/config/admin/brand'
import ManagementModule from '~/components/admin/menus/ManagementModule.vue'

definePageMeta({
  layout: 'admin',
  admin: true,
  middleware: 'admin',
  adminPermission: 'system.menus.read',
  adminTitle: '菜单管理'
})
defineI18nRoute(false)
useHead({title: `菜单管理 | ${companyBrand.name}`})
</script>
<template>
  <ManagementModule/>
</template>
