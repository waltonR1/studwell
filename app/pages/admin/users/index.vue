<!-- 账号路由装配，独立于官网。 -->
<script setup lang="ts">
import {companyBrand} from '~/config/admin/brand'
import ListModule from '~/components/admin/users/ListModule.vue'

definePageMeta({
  layout: 'admin',
  admin: true,
  middleware: 'admin',
  adminPermission: 'system.users.read',
  adminTitle: '账号管理'
})
defineI18nRoute(false)
useHead({title: `账号管理 | ${companyBrand.name}`})
</script>
<template>
  <ListModule/>
</template>
