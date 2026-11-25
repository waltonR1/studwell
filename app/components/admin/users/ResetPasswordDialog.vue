<script setup lang="ts">
defineProps<{ open: boolean; username: string; busy: boolean; canReset: boolean; error: string }>()
const password = defineModel<string>({required: true})
const emit = defineEmits<{ close: []; submit: []; blur: [] }>()
</script>
<template>
  <AdminCommonDialog :open="open" title="重置账号密码"
                     :description="`为账号“${username ?? ''}”设置新的初始密码。重置后，已登录的用户会退出，下次登录必须修改密码。`"
                     :busy="busy" @close="emit('close')">
    <form id="admin-reset-password" class="admin-fields" @submit.prevent="emit('submit')">
      <AdminUsersInitialPasswordField id="reset-user-password" v-model="password" label="新初始密码" purpose="reset"
                                       :disabled="busy || !canReset" :error="error" @blur="emit('blur')"/>
    </form>
    <template #actions>
      <UButton class="admin-button" :disabled="busy" @click="emit('close')">取消</UButton>
      <UButton v-if="canReset" class="admin-button admin-button-danger" type="submit" form="admin-reset-password"
               :disabled="busy">{{ busy ? '重置中…' : '重置密码' }}
      </UButton>
    </template>
  </AdminCommonDialog>
</template>
