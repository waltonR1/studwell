<!-- 首次改密及本人改密入口，服务端独立校验旧密码和受限会话。 -->
<script setup lang="ts">
import {companyBrand} from '~/config/admin/brand'
import AuthForm from '~/components/admin/auth/Form.vue'
import AuthPanel from '~/components/admin/auth/Panel.vue'

definePageMeta({layout: 'admin', admin: true, adminTitle: '修改密码', middleware: 'admin'})
defineI18nRoute(false)
useHead({title: `修改密码 | ${companyBrand.name}`, meta: [{name: 'robots', content: 'noindex,nofollow'}]})
</script>
<template>
  <AuthPanel mode="password" title="修改密码" description="设置新密码，完成后请重新登录。">
    <AuthForm mode="password"/>
  </AuthPanel>
</template>
