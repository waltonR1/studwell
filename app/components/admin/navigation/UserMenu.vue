<!-- 后台导航UserMenu展示；状态由 Frame 的页面作用域持有。 -->
<script setup lang="ts">
import {ChevronDown, UserRound, KeyRound, LogOut} from 'lucide-vue-next'
import type {useAdminFrame} from '~/composables/admin/navigation/useAdminFrame'

const props = defineProps<{
  state: Pick<ReturnType<typeof useAdminFrame>, 'userMenuOpen' | 'userName' | 'userInitial' | 'userRole' | 'session' | 'busy' | 'logout'>
}>()
const {userMenuOpen, userName, userInitial, userRole, session, busy, logout} = props.state
const route = useRoute()
</script>
<template>
  <div class="admin-user-menu-wrap">
    <button class="admin-user-trigger" type="button" aria-haspopup="menu" :aria-expanded="userMenuOpen"
            aria-label="打开用户菜单" @click="userMenuOpen = !userMenuOpen">
      <span class="admin-user-avatar" aria-hidden="true">{{ userInitial }}</span>
      <span class="admin-user-meta"><strong>{{ userName }}</strong><small>{{ userRole }}</small></span>
      <ChevronDown class="admin-user-chevron" :class="{ 'admin-user-chevron-open': userMenuOpen }" aria-hidden="true"/>
    </button>
    <div v-if="userMenuOpen" class="admin-user-menu" role="menu" aria-label="账户与全局操作">
      <div class="admin-user-menu-heading"><span class="admin-user-avatar" aria-hidden="true">{{ userInitial }}</span>
        <div><strong>{{ userName }}</strong><small>{{ session?.user?.username }}</small></div>
      </div>
      <NuxtLink class="admin-user-menu-item" to="/admin/profile" role="menuitem">
        <UserRound aria-hidden="true"/>
        <span>个人资料</span></NuxtLink>
      <NuxtLink class="admin-user-menu-item"
                :to="{ path: '/admin/change-password', query: { redirect: route.fullPath } }" role="menuitem">
        <KeyRound aria-hidden="true"/>
        <span>修改密码</span></NuxtLink>
      <div class="admin-user-menu-separator" role="separator"/>
      <button class="admin-user-menu-item admin-user-menu-danger" type="button" role="menuitem" :disabled="busy"
              @click="logout">
        <LogOut aria-hidden="true"/>
        <span>{{ busy ? '正在退出…' : '退出登录' }}</span></button>
    </div>
  </div>
</template>
