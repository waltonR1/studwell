<!-- 后台角色路由装配，不引入官网布局与动画。 -->
<script setup lang="ts">
import {companyBrand} from '~/config/admin/brand'
import RoleModule from '~/components/admin/roles/ListModule.vue'

definePageMeta({
  layout: 'admin',
  admin: true,
  middleware: 'admin',
  adminPermission: 'system.roles.read',
  adminTitle: '角色管理'
})
defineI18nRoute(false)
useHead({title: `角色管理 | ${companyBrand.name}`})
</script>
<template>
  <RoleModule/>
</template>
