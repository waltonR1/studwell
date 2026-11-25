<script setup lang="ts">
import {companyBrand} from '~/config/admin/brand'
import ListModule from '~/components/admin/logs/ListModule.vue'

definePageMeta({
  layout: 'admin',
  admin: true,
  middleware: 'admin',
  adminPermission: 'system.logs.login.read',
  adminTitle: '登录日志'
})
defineI18nRoute(false)
useHead({title: `登录日志 | ${companyBrand.name}`})
</script>
<template>
  <ListModule kind="login"/>
</template>
