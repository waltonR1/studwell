<!-- 中文独立登录入口，无官网语言前缀。 -->
<script setup lang="ts">
import {companyBrand} from '~/config/admin/brand'
import AuthForm from '~/components/admin/auth/Form.vue'
import AuthPanel from '~/components/admin/auth/Panel.vue'

definePageMeta({layout: 'admin', admin: true, middleware: 'admin'})
defineI18nRoute(false)
useHead({title: `后台登录 | ${companyBrand.name}`, meta: [{name: 'robots', content: 'noindex,nofollow'}]})
</script>
<template>
  <AuthPanel mode="login" title="登录管理后台" description="请使用你的管理账号登录。">
    <AuthForm mode="login"/>
  </AuthPanel>
</template>
