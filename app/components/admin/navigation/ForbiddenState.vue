<script setup lang="ts">
import {ShieldAlert, ArrowLeft} from 'lucide-vue-next'
import {safeAdminRedirect} from '~/utils/admin/auth/redirect'
const route = useRoute()
const target = computed(() => {
  if (typeof route.query.from !== 'string') return ''
  const path = safeAdminRedirect(route.query.from).split(/[?#]/)[0]
  return path && path !== '/admin' ? path : ''
})
</script>

<template>
  <section class="admin-module admin-forbidden" aria-labelledby="admin-forbidden-title">
    <div class="admin-forbidden-card">
      <div class="admin-forbidden-icon"><ShieldAlert aria-hidden="true"/></div>
      <p class="admin-forbidden-eyebrow">访问受限</p>
      <h1 id="admin-forbidden-title">没有访问权限</h1>
      <p class="admin-forbidden-description">当前账号暂无此页面的访问权限。<br>如需访问，请联系管理员。</p>
      <p v-if="target" class="admin-forbidden-target">目标页面 <code>{{ target }}</code></p>
      <NuxtLink class="admin-button admin-button-primary" to="/admin"><ArrowLeft aria-hidden="true"/>返回后台首页</NuxtLink>
    </div>
  </section>
</template>

<style scoped src="~/assets/admin/css/pages/forbidden.css"></style>
