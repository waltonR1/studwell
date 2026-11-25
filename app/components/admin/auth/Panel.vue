<script setup lang="ts">
import AdminBrandLogo from '~/components/admin/brand/BrandLogo.vue'
import {companyBrand} from '~/config/admin/brand'
defineProps<{ title: string; description: string; mode: 'login' | 'password' }>()
</script>

<template>
  <section class="admin-auth-page" :class="'admin-auth-page-' + mode" aria-labelledby="admin-auth-title">
    <div class="admin-auth-panel">
      <div class="admin-auth-brand"><AdminBrandLogo /><span>管理后台</span></div>
      <header class="admin-auth-heading"><h1 id="admin-auth-title">{{ title }}</h1><p>{{ description }}</p></header>
      <slot/>
      <p class="admin-auth-footer">{{ companyBrand.name }} · 后台管理系统</p>
    </div>
  </section>
</template>

<style scoped src="~/assets/admin/css/pages/auth.css"></style>
