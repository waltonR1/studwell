<!-- 后台导航Topbar展示；状态由 Frame 的页面作用域持有。 -->
<script setup lang="ts">
import {ChevronRight, Menu as MenuIcon, PanelLeftOpen, PanelLeftClose, RefreshCw} from 'lucide-vue-next'
import UserMenu from './UserMenu.vue'
import type {useAdminFrame} from '~/composables/admin/navigation/useAdminFrame'

const props = defineProps<{
  state: Pick<ReturnType<typeof useAdminFrame>, 'navigationExpanded' | 'isCompact' | 'mobileOpen' | 'railCollapsed' | 'toggleNavigation' | 'visibleCrumbs' | 'crumbDestination' | 'currentPage' | 'detailLabel' | 'contextTitle' | 'refreshing' | 'refreshRegistry' | 'refreshCurrentPage' | 'refreshStatus' | 'userMenuOpen' | 'userName' | 'userInitial' | 'userRole' | 'session' | 'busy' | 'logout'>
}>()
const {
  navigationExpanded,
  isCompact,
  mobileOpen,
  railCollapsed,
  toggleNavigation,
  visibleCrumbs,
  crumbDestination,
  currentPage,
  detailLabel,
  contextTitle,
  refreshing,
  refreshRegistry,
  refreshCurrentPage,
  refreshStatus
} = props.state
const currentDetailLabel=computed(()=>toValue(detailLabel))
const route = useRoute()
</script>
<template>
  <header class="admin-topbar">
    <div class="admin-topbar-context">
      <button type="button" class="admin-topbar-icon-button admin-navigation-toggle" :aria-expanded="navigationExpanded"
              :aria-label="isCompact ? (mobileOpen ? '关闭侧栏' : '打开侧栏') : railCollapsed ? '展开侧栏' : '折叠侧栏'"
              :title="isCompact ? (mobileOpen ? '关闭侧栏' : '打开侧栏') : railCollapsed ? '展开侧栏' : '折叠侧栏'"
              @click="toggleNavigation">
        <MenuIcon v-if="isCompact && !mobileOpen" aria-hidden="true"/>
        <PanelLeftOpen v-else-if="railCollapsed" aria-hidden="true"/>
        <PanelLeftClose v-else aria-hidden="true"/>
      </button>
      <div class="admin-context-copy">
        <nav class="admin-breadcrumb" aria-label="后台位置">
          <NuxtLink v-if="!isCompact && route.path !== '/admin'" to="/admin">后台首页</NuxtLink>
          <span v-else-if="isCompact && route.path === '/admin'" aria-current="page">后台首页</span>
          <template v-for="crumb in visibleCrumbs" :key="crumb.id">
            <ChevronRight class="admin-breadcrumb-separator" aria-hidden="true"/>
            <NuxtLink v-if="crumbDestination(crumb)" :to="crumbDestination(crumb)!">{{ crumb.name }}</NuxtLink>
            <span v-else :aria-current="crumb.id === currentPage?.id ? 'page' : undefined">{{ crumb.name }}</span>
          </template>
          <template v-if="route.params.id">
            <template v-if="currentDetailLabel?.path === route.path">
              <template v-for="parent in currentDetailLabel.parents ?? []" :key="parent.to">
                <ChevronRight class="admin-breadcrumb-separator" aria-hidden="true"/>
                <NuxtLink :to="parent.to">{{ parent.label }}</NuxtLink>
              </template>
              <ChevronRight class="admin-breadcrumb-separator" aria-hidden="true"/>
              <span aria-current="page">{{ currentDetailLabel.label }}</span>
            </template>
          </template>
          <template v-else-if="!currentPage && route.path !== '/admin'">
            <ChevronRight class="admin-breadcrumb-separator" aria-hidden="true"/>
            <span aria-current="page">{{ contextTitle }}</span></template>
        </nav>
      </div>
    </div>
    <div class="admin-topbar-actions">
      <button type="button" class="admin-topbar-icon-button admin-refresh-button"
              :disabled="refreshing || refreshRegistry.blocked.value"
              :aria-label="refreshing ? '正在刷新当前页面、导航与权限' : '刷新当前页面、导航与权限'"
              :title="refreshing ? '正在刷新…' : '刷新当前页面、导航与权限'" @click="refreshCurrentPage">
        <RefreshCw :class="{ 'admin-refresh-spinning': refreshing }" aria-hidden="true"/>
      </button>
      <span class="admin-sr-only" role="status" aria-live="polite">{{ refreshStatus }}</span>
      <UserMenu :state="state"/>

    </div>
  </header>
</template>
