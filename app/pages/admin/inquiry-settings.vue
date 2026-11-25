<script setup lang="ts">
import {companyBrand} from '~/config/admin/brand'
import SettingsModule from '~/components/admin/inquiries/SettingsModule.vue'

definePageMeta({layout:'admin', admin:true, middleware:'admin', adminPermission:'content.inquiries.settings', adminTitle:'咨询类型'})
defineI18nRoute(false)
useHead({title: `咨询类型 | ${companyBrand.name}`})
</script>

<template>
  <SettingsModule mode="categories"/>
</template>
