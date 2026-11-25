<!-- 首页仅装配后台模块；统计按权限读取，入口复用可见菜单。 -->
<script setup lang="ts">
import {companyBrand} from '~/config/admin/brand'
import OverviewModule from '~/components/admin/dashboard/OverviewModule.vue'

definePageMeta({layout: 'admin', admin: true, middleware: 'admin'})
defineI18nRoute(false)
useHead({title: `后台 | ${companyBrand.name}`, meta: [{name: 'robots', content: 'noindex,nofollow'}]})
</script>
<template>
  <OverviewModule/>
</template>
