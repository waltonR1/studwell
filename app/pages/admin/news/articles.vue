<script setup lang="ts">
import NewsModule from '~/components/admin/news/NewsModule.vue'
definePageMeta({layout:'admin',admin:true,middleware:'admin',adminPermission:'content.news.read',adminTitle:'文章管理'})
defineI18nRoute(false)
</script>
<template><NewsModule mode="articles"/></template>
