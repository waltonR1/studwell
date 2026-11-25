<script setup lang="ts">
import {companyBrand} from '~/config/admin/brand'
import ForbiddenState from '~/components/admin/navigation/ForbiddenState.vue'

definePageMeta({layout: 'admin', admin: true, middleware: 'admin'})
defineI18nRoute(false)
useHead({title: `没有访问权限 | ${companyBrand.name}`, meta: [{name: 'robots', content: 'noindex,nofollow'}]})
</script>

<template><ForbiddenState/></template>
