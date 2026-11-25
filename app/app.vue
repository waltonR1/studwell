<!-- 应用根组件：承载全站布局与页面，并设置页面语言和网站图标。 -->
<script setup lang="ts">
import {adminHtmlLanguage,supportedLanguageCatalog} from '#shared/config/site-languages'
// 脚本职责：根据当前语言设置 HTML lang，并注册全站 favicon。
const { locale } = useI18n()
const route = useRoute()
const isAdmin = computed(() => route.meta.admin === true || /^\/admin(?:\/|$)/.test(route.path))
useHead(() => ({
  htmlAttrs: { lang: isAdmin.value&&route.meta.layout!==false?adminHtmlLanguage:supportedLanguageCatalog.find(language=>language.code===locale.value)?.language??locale.value },
  link: isAdmin.value ? [{ rel: 'icon', href: '/favicon.ico' }] : [],
}))
</script>

<template>

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
</template>
