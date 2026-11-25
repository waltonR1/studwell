<!-- 账号复杂编辑路由装配。 -->
<script setup lang="ts">
import EditModule from '~/components/admin/users/EditModule.vue'

definePageMeta({
  layout: 'admin',
  admin: true,
  middleware: 'admin',
  adminPermission: 'system.users.read',
  adminTitle: '账号管理',
})
defineI18nRoute(false)
</script>
<template>
  <EditModule/>
</template>
