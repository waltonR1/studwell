<script setup lang="ts">
import NewsModule from '~/components/admin/news/NewsModule.vue'
definePageMeta({layout:'admin',admin:true,middleware:'admin',adminPermission:'content.news.read',adminTitle:'新闻分类'})
defineI18nRoute(false)
</script>
<template><NewsModule mode="categories"/></template>
