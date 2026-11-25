<script setup lang="ts">
import type {RouteLocationRaw} from 'vue-router'

defineProps<{ to: RouteLocationRaw }>()
</script>
<template>
  <NuxtLink class="admin-back-link" :to="to"><span aria-hidden="true">←</span>
    <slot/>
  </NuxtLink>
</template>
<style scoped>
.admin-back-link {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  box-sizing: border-box;
  padding: 7px 12px;
  margin-bottom: 13px;
  border: 1px solid #cbdcf0;
  border-radius: 7px;
  background: #f0f6fd;
  color: #245b91;
  font-size: 13px;
  font-weight: 550;
  line-height: 20px;
  text-decoration: none;
}

.admin-back-link:hover {
  border-color: #8eafd2;
  background: #e2eefb;
  color: #194b7c;
}

.admin-back-link:focus-visible {
  outline: 2px solid #3269a5;
  outline-offset: 3px;
}
</style>
