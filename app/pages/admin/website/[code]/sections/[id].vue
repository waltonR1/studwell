<script setup lang="ts">
import SectionModule from '~/components/admin/website/pages/SectionModule.vue'
import {websitePageKey} from '#shared/utils/website/page-layouts'
import {useAdminWebsitePagesStore} from '~/stores/admin/website-pages'

definePageMeta({
  key: route => route.path,
  layout: 'admin',
  admin: true,
  middleware: 'admin',
  adminPermission: 'content.pages.read',
  adminTitle: '网页维护'
})
defineI18nRoute(false)

const route = useRoute()
const pageKey = websitePageKey(String(route.params.code)), id = String(route.params.id)
const store = useAdminWebsitePagesStore()
onBeforeUnmount(() => store.leave(pageKey, id))
await callOnce(`website-${pageKey}-${id}`, () => store.enter(pageKey, id), {mode: 'navigation'})
</script>
<template>
  <SectionModule/>
</template>
