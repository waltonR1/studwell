<script setup lang="ts">
definePageMeta({layout:'admin',admin:true,middleware:'admin',adminPermission:'content.templates.read',adminTitle:'区块模板'})
defineI18nRoute(false)
</script>
<template>
 <AdminWebsiteTemplatesModule/>
</template>
