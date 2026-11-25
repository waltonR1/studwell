<script setup lang="ts">
import {CircleCheck, CircleAlert, TriangleAlert, X} from 'lucide-vue-next'
import {watch, onBeforeUnmount} from 'vue'
import type {AdminToastNotification} from '~/types/admin/interaction'
import {ADMIN_TOAST_DURATION_MS} from '~/config/admin/interaction'

const props = defineProps<{ notification: AdminToastNotification | null }>()
const emit = defineEmits<{ dismiss: [] }>()
let timer: ReturnType<typeof setTimeout> | undefined
watch(() => props.notification, notification => {
  clearTimeout(timer)
  if (notification && (!notification.tone || notification.tone === 'success')) timer = setTimeout(() => emit('dismiss'), ADMIN_TOAST_DURATION_MS)
}, {immediate: true})
onBeforeUnmount(() => clearTimeout(timer))
</script>
<template>
  <div class="admin-toast-region">
    <Transition name="admin-toast">
      <div v-if="notification" class="admin-toast-message" :class="'admin-toast-' + (notification.tone || 'success')"
           :role="notification.tone === 'error' ? 'alert' : 'status'" aria-atomic="true">
        <component
            :is="notification.tone === 'error' ? CircleAlert : notification.tone === 'warning' ? TriangleAlert : CircleCheck"
            class="admin-toast-check" aria-hidden="true"/>
        <span>{{ notification.message }}</span>
        <button type="button" aria-label="关闭提示" @click="emit('dismiss')">
          <X aria-hidden="true"/>
        </button>
      </div>
    </Transition>
  </div>
</template>
<style scoped>
.admin-toast-region {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  width: max-content;
  z-index: 75;
  max-width: min(560px, calc(100vw - 32px));
  pointer-events: none;
}

.admin-toast-message {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 14px 13px 16px;
  border: 1px solid #cce3d6;
  border-radius: 10px;
  background: #fff;
  color: #365b49;
  box-shadow: 0 8px 30px #213c4826;
  font-size: 13px;
  pointer-events: auto;
}

.admin-toast-check {
  width: 19px;
  height: 19px;
  flex-shrink: 0;
  color: #358365;
}

.admin-toast-error {
  border-color: #f0cccc;
  color: #a33434;
}

.admin-toast-warning {
  border-color: #ecd7ae;
  color: #8b651f;
}

.admin-toast-error .admin-toast-check, .admin-toast-warning .admin-toast-check {
  color: inherit;
}

.admin-toast-message button {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  margin-left: 8px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #87988e;
  cursor: pointer;
}

.admin-toast-message > span { min-width: 0; overflow-wrap: anywhere; line-height: 1.7; }

.admin-toast-message button:hover {
  background: #eff5f1;
}

.admin-toast-message button svg {
  width: 15px;
  height: 15px;
}

.admin-toast-enter-active, .admin-toast-leave-active {
  transition: opacity .16s ease, transform .16s ease;
}

.admin-toast-enter-from, .admin-toast-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 600px) {
  .admin-toast-region {
    top: 72px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .admin-toast-enter-active, .admin-toast-leave-active {
    transition: none;
  }
}
</style>
