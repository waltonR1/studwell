<script setup lang="ts">
defineProps<{ title: string; description?: string }>()
</script>

<template>
  <header class="admin-page-header">
    <div class="admin-page-heading">
      <slot name="eyebrow"/>
      <h1>{{ title }}</h1>
      <p v-if="description">{{ description }}</p>
      <slot/>
    </div>
    <div v-if="$slots.actions" class="admin-page-actions">
      <slot name="actions"/>
    </div>
  </header>
</template>

<style scoped>
.admin-page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 20px;
}

.admin-page-heading {
  min-width: 0;
}

.admin-page-heading h1 {
  margin: 0 0 8px;
}

.admin-page-heading p {
  margin: 0;
  color: #596a7c;
  max-width: 820px;
}

.admin-page-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

@media (max-width: 700px) {
  .admin-page-header {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
  }

  .admin-page-actions {
    justify-content: flex-start;
  }
}
</style>
