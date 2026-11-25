<script setup lang="ts">
import {companyBrand} from '~/config/admin/brand'
import ProfileModule from '~/components/admin/profile/ProfileModule.vue'

definePageMeta({layout: 'admin', admin: true, adminTitle: '个人资料', middleware: 'admin'})
defineI18nRoute(false)
useHead({title: `个人资料 | ${companyBrand.name}`, meta: [{name: 'robots', content: 'noindex,nofollow'}]})
</script>
<template>
  <ProfileModule/>
</template>
