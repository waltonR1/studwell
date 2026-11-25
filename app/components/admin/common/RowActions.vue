<template>
  <div class="admin-row-actions">
    <slot/>
  </div>
</template>
<style scoped>
.admin-row-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.admin-row-actions :deep(.admin-button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 32px;
  margin: 0;
  padding: 5px 10px;
  box-sizing: border-box;
  border: 1px solid #cbdcf0;
  border-radius: 6px;
  background: #f0f6fd;
  color: #245b91;
  font-size: 12px;
  font-weight: 550;
  line-height: 20px;
  white-space: nowrap;
}

.admin-row-actions :deep(.admin-button:hover:not(:disabled)) {
  border-color: #8eafd2;
  background: #e2eefb;
  color: #194b7c;
}

.admin-row-actions :deep(.admin-button[data-tone='danger']) {
  border-color: #efcbd1;
  background: #fff3f4;
  color: #ad354b;
}

.admin-row-actions :deep(.admin-button[data-tone='danger']:hover:not(:disabled)) {
  border-color: #d8919f;
  background: #fde7eb;
  color: #93273d;
}

.admin-row-actions :deep(.admin-button:focus-visible) {
  outline: 2px solid #3269a5;
  outline-offset: 2px;
}
</style>
