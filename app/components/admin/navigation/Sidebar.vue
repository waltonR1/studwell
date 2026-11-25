<!-- 后台导航Sidebar展示；状态由 Frame 的页面作用域持有。 -->
<script setup lang="ts">
import AdminBrandLogo from '~/components/admin/brand/BrandLogo.vue'
import {companyBrand} from '~/config/admin/brand'
import {House, ChevronDown} from 'lucide-vue-next'
import type {useAdminFrame} from '~/composables/admin/navigation/useAdminFrame'

const props = defineProps<{
  state: Pick<ReturnType<typeof useAdminFrame>, 'railCollapsed' | 'contextTitle' | 'visibleItems' | 'currentAncestors' | 'currentPage' | 'closed' | 'toggle' | 'showNavigationTooltip' | 'hideNavigationTooltip' | 'navigationTooltip' | 'pending' | 'error' | 'items'>;
}>()
const {
  railCollapsed,
  contextTitle,
  visibleItems,
  currentAncestors,
  currentPage,
  closed,
  toggle,
  showNavigationTooltip,
  hideNavigationTooltip,
  navigationTooltip,
  pending,
  error,
  items
} = props.state
const route = useRoute()
</script>
<template>
  <aside class="admin-sidebar" aria-label="后台侧栏">
    <div class="admin-sidebar-head">
      <NuxtLink class="admin-brand" to="/admin" :aria-label="`${companyBrand.name} 管理后台，${contextTitle}`"
                :title="railCollapsed ? companyBrand.name + ' 管理后台' : undefined">
        <AdminBrandLogo :collapsed="railCollapsed" decorative />
      </NuxtLink>
    </div>
    <nav class="admin-navigation" aria-label="后台主导航">
      <NuxtLink class="admin-nav-item" :class="{ 'admin-nav-home-active': route.path === '/admin' }"
                :data-nav-label="railCollapsed ? '后台首页' : undefined" to="/admin" title="后台首页"
                :aria-current="route.path === '/admin' ? 'page' : undefined"
                @pointerenter="showNavigationTooltip('后台首页', $event)" @pointerleave="hideNavigationTooltip"
                @focus="showNavigationTooltip('后台首页', $event)" @blur="hideNavigationTooltip">
        <House class="admin-nav-icon" aria-hidden="true"/>
        <span v-if="!railCollapsed" class="admin-nav-label">后台首页</span>
      </NuxtLink>
      <template v-for="item in visibleItems" :key="item.id">
        <div v-if="item.depth === 0" class="admin-nav-divider" aria-hidden="true"/>
        <div v-if="item.path" class="admin-nav-page-row">
        <NuxtLink class="admin-nav-item"
                  :class="{ 'admin-nav-section-active': currentAncestors.has(item.id), 'admin-nav-child': item.depth > 0, 'admin-nav-depth-root': item.depth === 0 }"
                  :style="{ paddingLeft: `${12 + (railCollapsed ? 0 : item.depth * 16)}px` }" :data-depth="item.depth"
                  :data-nav-label="railCollapsed ? item.name : undefined" :to="item.path" :title="item.name"
                  :aria-label="item.name" :aria-current="currentPage?.id === item.id ? 'page' : undefined"
                  @pointerenter="showNavigationTooltip(item.name, $event)" @pointerleave="hideNavigationTooltip"
                  @focus="showNavigationTooltip(item.name, $event)" @blur="hideNavigationTooltip">
          <AdminCommonMenuIcon :icon-key="item.iconKey" class="admin-nav-icon" aria-hidden="true"/>
          <span v-if="!railCollapsed" class="admin-nav-label">{{ item.name }}</span>
        </NuxtLink>
        <button v-if="items.some(child=>child.parentId===item.id)" type="button" class="admin-nav-page-toggle" :aria-label="(closed.includes(item.code)?'展开':'折叠')+item.name" :aria-expanded="!closed.includes(item.code)" @click="toggle(item.code)"><ChevronDown :class="{'admin-nav-chevron-closed':closed.includes(item.code)}" aria-hidden="true"/></button>
        </div>
        <button v-else class="admin-nav-item admin-nav-parent"
                :class="{ 'admin-nav-section-active': currentAncestors.has(item.id), 'admin-nav-child': item.depth > 0, 'admin-nav-depth-root': item.depth === 0 }"
                type="button" :style="{ paddingLeft: `${12 + (railCollapsed ? 0 : item.depth * 16)}px` }"
                :data-depth="item.depth" :data-nav-label="railCollapsed ? item.name : undefined" :title="item.name"
                :aria-label="item.name" :aria-current="currentAncestors.has(item.id) ? 'true' : undefined"
                :aria-expanded="!closed.includes(item.code)" @click="toggle(item.code)"
                @pointerenter="showNavigationTooltip(item.name, $event)" @pointerleave="hideNavigationTooltip"
                @focus="showNavigationTooltip(item.name, $event)" @blur="hideNavigationTooltip">
          <AdminCommonMenuIcon :icon-key="item.iconKey" class="admin-nav-icon" aria-hidden="true"/>
          <span v-if="!railCollapsed" class="admin-nav-label">{{ item.name }}</span>
          <ChevronDown class="admin-nav-chevron" :class="{ 'admin-nav-chevron-closed': closed.includes(item.code) }"
                       aria-hidden="true"/>
        </button>
      </template>
    </nav>
    <div v-if="railCollapsed && navigationTooltip" class="admin-rail-tooltip" role="tooltip"
         :style="{ top: `${navigationTooltip.top}px` }">{{ navigationTooltip.label }}
    </div>
    <p v-if="!pending && !error && !items.length && !railCollapsed" class="admin-nav-note">
      暂无可见菜单；菜单授权与操作权限均满足时才会显示。</p>
  </aside>
</template>

<style scoped>
.admin-nav-page-row { display:flex; align-items:stretch; }
.admin-nav-page-row > .admin-nav-item { flex:1; min-width:0; }
.admin-nav-page-toggle { display:flex; align-items:center; justify-content:center; width:28px; flex-shrink:0; background:transparent; border:0; color:inherit; cursor:pointer; }
.admin-nav-page-toggle svg { width:14px; height:14px; }
</style>
