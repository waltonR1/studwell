<script setup lang="ts">
import {companyBrand} from '~/config/admin/brand';
import Module from '~/components/admin/media/LibraryModule.vue';
definePageMeta({ layout: 'admin', admin: true, middleware: 'admin', adminPermission: 'content.media.read', adminTitle: '媒体库' });
defineI18nRoute(false);
useHead({title: `媒体库 | ${companyBrand.name}`});
</script>
<template><Module/></template>
