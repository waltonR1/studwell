<!-- 后台导航框架：刷新注册表在共同祖先创建，展示区块消费同一状态。 -->
<script setup lang="ts">
import Sidebar from './Sidebar.vue'
import Topbar from './Topbar.vue'
import {useAdminFrame} from '~/composables/admin/navigation/useAdminFrame'

const props = withDefaults(defineProps<{ active?: boolean }>(), {active: false})
const state = useAdminFrame(props)
const {railCollapsed, mobileOpen, error, notification, ready} = state
await ready
</script>
<template>
  <div class="admin-frame"
       :class="{ 'admin-frame-collapsed': active && railCollapsed, 'admin-frame-mobile-open': active && mobileOpen, 'admin-frame-without-navigation': !active }">
    <button v-if="active && mobileOpen" class="admin-sidebar-scrim" type="button" aria-label="关闭侧栏"
            @click="mobileOpen = false"/>
    <Sidebar v-if="active" :state="state"/>

    <div class="admin-workspace">
      <Topbar v-if="active" :state="state"/>
      <AdminCommonFeedback v-if="active && error" class="admin-navigation-feedback">{{
          error
        }}
      </AdminCommonFeedback>
      <AdminCommonToast :notification="notification" @dismiss="notification = null"/>
      <slot/>
    </div>
  </div>
</template>
<style scoped src="~/assets/admin/css/layout/navigation.css"></style>
