<script setup lang="ts">
import { companyBrand } from '~/config/admin/brand'

withDefaults(defineProps<{ collapsed?: boolean; decorative?: boolean }>(), {
  collapsed: false,
  decorative: false,
})
</script>

<template>
  <img
    :src="collapsed ? companyBrand.logoMark : companyBrand.logo"
    :srcset="collapsed ? undefined : companyBrand.logoSrcSet"
    :width="collapsed ? 541 : 300"
    :height="collapsed ? 494 : 110"
    :alt="decorative ? '' : companyBrand.name"
    fetchpriority="high"
    class="admin-brand-logo"
  />
</template>
