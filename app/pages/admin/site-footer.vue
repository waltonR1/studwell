<script setup lang="ts">
import SiteSettingsModule from '~/components/admin/website/site/MaintenanceModule.vue'
import {companyBrand} from '~/config/admin/brand'
definePageMeta({layout: 'admin', admin: true, middleware: 'admin', adminPermission: 'content.site_settings.read', adminTitle: '页脚维护'})
defineI18nRoute(false)
useHead({title: `页脚维护 | ${companyBrand.name}`})
</script>
<template><SiteSettingsModule page="footer" /></template>
