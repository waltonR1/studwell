<script setup lang="ts">
import PositionsModule from '~/components/admin/careers/PositionsModule.vue'

definePageMeta({layout:'admin',admin:true,middleware:'admin',adminPermission:'content.careers.read',adminTitle:'岗位管理'})
defineI18nRoute(false)
</script>

<template>
  <PositionsModule />
</template>
