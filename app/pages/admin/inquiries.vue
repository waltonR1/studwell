<script setup lang="ts">
import {companyBrand} from '~/config/admin/brand'
import ListModule from '~/components/admin/inquiries/ListModule.vue'

definePageMeta({layout:'admin', admin:true, middleware:'admin', adminPermission:'content.inquiries.read', adminTitle:'咨询列表'})
defineI18nRoute(false)
useHead({title: `咨询列表 | ${companyBrand.name}`})
</script>

<template>
  <ListModule/>
</template>
