<script setup lang="ts">
withDefaults(defineProps<{
  state: 'loading' | 'error' | 'empty'
  title?: string
  description?: string
}>(), {title: '', description: ''})
</script>

<template>
  <div class="admin-data-state" :class="`admin-data-state-${state}`" :role="state === 'error' ? 'alert' : 'status'">
    <strong>{{ title || (state === 'loading' ? '加载中…' : state === 'error' ? '数据加载失败' : '暂无数据') }}</strong>
    <p v-if="description">{{ description }}</p>
    <div v-if="$slots.action">
      <slot name="action"/>
    </div>
  </div>
</template>

<style scoped>
.admin-data-state {
  background: #fff;
  border: 1px solid #dce1e7;
  border-radius: 8px;
  padding: 28px;
  text-align: center;
  color: #334155;
}

.admin-data-state p {
  margin: 8px auto 0;
  max-width: 720px;
  color: #596a7c;
}

.admin-data-state-error {
  border-color: #dfa0a7;
  background: #fff8f8;
  color: #791a26;
}

.admin-data-state > div {
  margin-top: 14px;
}
</style>
