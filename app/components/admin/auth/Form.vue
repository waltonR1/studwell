<!-- 认证表单交互：秘密输入仅在页面作用域持有，身份和请求由既有 store 管理。 -->
<script setup lang="ts">

import {useAdminAuthForm} from '~/composables/admin/auth/useAdminAuthForm'

const props = defineProps<{ mode: 'login' | 'password' }>()
const {
  session,
  policy,
  returnTo,
  forcedChange,
  username,
  password,
  newPassword,
  confirmPassword,
  notification,
  loading,
  error,
  fieldErrors,
  logout,
  submit
} = useAdminAuthForm(props)
</script>
<template>
  <form class="admin-auth-form" :id="mode === 'login' ? 'admin-login-form' : 'admin-password-form'"
        :aria-busy="loading" @submit.prevent="submit">
    <p v-if="forcedChange" class="admin-auth-description">为保障账号安全，请先设置新密码。</p>
    <p v-else-if="mode === 'password'" class="admin-auth-description">
      修改密码后，所有登录会话将失效，请使用新密码重新登录。</p>
    <input v-if="mode === 'password'" :value="session?.user?.username" name="username" autocomplete="username"
           class="admin-auth-username" tabindex="-1" aria-hidden="true" readonly>
    <label v-if="mode === 'login'">用户名<input id="admin-login-username" v-model="username" name="username" required
                                                autocomplete="username" maxlength="64" class="admin-input" :disabled="loading"></label>
    <label>{{ mode === 'login' ? '密码' : '当前密码' }}
      <AdminCommonPasswordField :id="mode === 'login' ? 'admin-login-password' : 'admin-current-password'"
                                v-model="password" name="password" required autocomplete="current-password"
                                :disabled="loading"/>
    </label>
    <template v-if="mode === 'password'">
      <label>新密码
        <AdminCommonPasswordField id="admin-new-password" v-model="newPassword" name="new-password" required
                                  autocomplete="new-password" :maxlength="policy.maxLength" :disabled="loading"
                                  :aria-invalid="!!fieldErrors.newPassword"
                                  aria-describedby="admin-new-password-help admin-new-password-error"/>
        <span id="admin-new-password-help" class="admin-auth-field-help">请输入 {{
            policy.minLength
          }}–{{ policy.maxLength }} 个字符。</span><span id="admin-new-password-error"
                                                        class="admin-field-error" aria-live="polite">{{
            fieldErrors.newPassword
          }}</span></label>
      <label>确认新密码
        <AdminCommonPasswordField id="admin-confirm-password" v-model="confirmPassword" name="confirm-password"
                                  :aria-invalid="!!fieldErrors.confirmPassword"
                                  aria-describedby="admin-confirm-password-error" required autocomplete="new-password"
                                  :maxlength="policy.maxLength" :disabled="loading"/>
        <span id="admin-confirm-password-error"
              class="admin-field-error" aria-live="polite">{{ fieldErrors.confirmPassword }}</span></label>
    </template>
    <AdminCommonFeedback v-if="error" role="alert">{{ error }}</AdminCommonFeedback>
    <div v-if="mode === 'password'" class="admin-auth-actions">
      <button v-if="forcedChange" type="button" class="admin-button" :disabled="loading" @click="logout">登出</button>
      <NuxtLink v-else class="admin-button" :to="returnTo" :aria-disabled="loading"
                @click="loading && $event.preventDefault()">取消修改
      </NuxtLink>
      <button type="submit" class="admin-button admin-button-primary" :disabled="loading">
        {{ loading ? '修改中…' : '确认修改' }}
      </button>
    </div>
    <button v-else type="submit" class="admin-button admin-button-primary admin-auth-submit" :disabled="loading">{{ loading ? '登录中…' : '登录' }}</button>
  </form>
  <AdminCommonToast :notification="notification" @dismiss="notification = null"/>
</template>
<style scoped>
.admin-auth-form {
  display: grid;
  gap: 22px;
  margin-top: 24px;
}

label {
  display: grid;
  gap: 8px;
  font-weight: 600;
  color: #405166;
  font-size: 13px;
}

.admin-field-error {
  display: block;
  min-height: 1.5em;
  color: #a11725;
  font-weight: 400;
  line-height: 1.5;
}

input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d5dfea;
  min-height: 44px;
  box-sizing: border-box;
  background: white;
  border-radius: 8px;
  color: #182230;
}

input:focus {border-color: #6c95bf;}
input:disabled {background: #f6f8fb; color: #8a96a5;}

button[type="submit"] {
  min-height: 44px;
  font-weight: 600;
  padding: 12px;
  background: #204e78;
  color: white;
  border-radius: 4px;
}

.admin-auth-description {
  margin: 0;
  color: #778497;
  font-size: 13px;
  font-weight: 400;
}

.admin-auth-field-help {
  color: #8491a2;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.5;
}

.admin-auth-username {
  min-height: 0;
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  border: 0;
  opacity: 0;
  pointer-events: none;
}

.admin-auth-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
}

.admin-auth-actions > .admin-button {
  min-width: 0;
  min-height: 44px;
  box-sizing: border-box;
  padding: 10px 8px;
  border-radius: 6px;
  font-size: 13px;
  text-align: center;
}

.admin-auth-form :deep(.admin-password-input input) {
  min-height: 44px;
  border-radius: 4px;
}
</style>
