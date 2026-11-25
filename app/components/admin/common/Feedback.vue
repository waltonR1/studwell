<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'info' | 'success' | 'warning' | 'error'; title?: string }>(), {
  tone: 'error',
  title: ''
})
</script>

<template>
  <div class="admin-feedback" :class="`admin-feedback-${tone}`" :role="tone === 'error' ? 'alert' : 'status'">
    <div class="admin-feedback-copy">
      <strong v-if="title">{{ title }}</strong>
      <div>
        <slot/>
      </div>
    </div>
    <div v-if="$slots.action" class="admin-feedback-action">
      <slot name="action"/>
    </div>
  </div>
</template>

<style scoped>
.admin-feedback {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  border: 1px solid;
  border-left-width: 4px;
  border-radius: 6px;
  padding: 12px 14px;
  margin: 12px 0;
}

.admin-feedback-copy {
  min-width: 0;
}

.admin-feedback-copy strong {
  display: block;
  margin-bottom: 4px;
}

.admin-feedback-info {
  background: #eef5fb;
  border-color: #abc4dd;
  color: #173d62;
}

.admin-feedback-success {
  background: #eef8f1;
  border-color: #9bc7aa;
  color: #1e5b35;
}

.admin-feedback-warning {
  background: #fff7e3;
  border-color: #e2bd68;
  color: #694700;
}

.admin-feedback-error {
  background: #fff0f1;
  border-color: #dfa0a7;
  color: #791a26;
}

.admin-feedback-action {
  flex: 0 0 auto;
}

@media (max-width: 700px) {
  .admin-feedback {
    flex-direction: column;
  }
}
</style>
