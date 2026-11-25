<!-- 后台独立布局：连接身份恢复、动态导航和结构化确认，不引入官网交互。 -->
<script setup lang="ts">
import {zh_cn} from '@nuxt/ui/locale'
import NavigationFrame from '~/components/admin/navigation/Frame.vue'
import ConfirmDialog from '~/components/admin/common/ConfirmDialog.vue'
import {useAdminActionConfirm} from '~/composables/admin/interaction/useAdminActionConfirm'
import type {AdminConfirmation} from '~/types/admin/interaction'
import {safeAdminRedirect} from '~/utils/admin/auth/redirect'
import {useAdminSessionStore} from '~/stores/admin/session'
import {useAdminNoticeStore} from '~/stores/admin/notice'

defineOptions({name: 'AdminLayout'})
const route = useRoute()
useHead({htmlAttrs: {'data-admin-scroll': 'true'}})
const auth = useAdminSessionStore(), noticeState = useAdminNoticeStore()
const {recovery} = storeToRefs(auth)
const {notice} = storeToRefs(noticeState)
const showNavigation = computed(() => auth.authenticated && route.path !== '/admin/login')
const isAuthPage = computed(() => route.path === '/admin/login' || route.path === '/admin/change-password')
const recoveryTarget = computed(() => safeAdminRedirect(recovery.value?.returnTo))
const confirmation = useAdminActionConfirm()
provide('admin-confirm', (request: AdminConfirmation) => confirmation.ask(request))
</script>

<template>
  <div class="admin-shell" data-admin-shell>
    <!-- 后台根节点 scrollbar-gutter 已预留空间，滚动锁定不再追加右侧宽度补偿。 -->
    <UApp :locale="zh_cn" :portal="false" :toaster="null" :scroll-body="{ padding: 0, margin: 0 }">
      <main id="admin-main-content" tabindex="-1">
        <section v-if="notice && !isAuthPage" class="admin-notice" role="alert">
          <div><strong>后台请求未完成</strong>
            <p>{{ notice.message }}</p></div>
          <UButton class="admin-button" @click="noticeState.clearNotice">关闭</UButton>
        </section>
        <section v-if="recovery && !isAuthPage" class="admin-session-notice" role="alert">
          <div>
            <strong>{{ recovery.kind === 'expired' ? '登录已失效' : '需要先修改密码' }}</strong>
            <p>{{
                recovery.kind === 'expired' ? '当前页面中的未保存内容仍保留在浏览器内。重新登录后可继续操作。' : '完成密码修改并重新登录后，可返回之前的后台页面。'
              }}</p>
          </div>
          <NuxtLink class="admin-button"
                    :to="{ path: recovery.kind === 'expired' ? '/admin/login' : '/admin/change-password', query: { redirect: recoveryTarget } }">
            {{ recovery.kind === 'expired' ? '重新登录' : '修改密码' }}
          </NuxtLink>
        </section>
        <NavigationFrame :active="showNavigation">
          <slot/>
          <p v-if="showNavigation" class="admin-timezone-note">页面时间均为北京时间（UTC+8）</p></NavigationFrame>
        <ConfirmDialog :confirmation="confirmation.state.value" @settle="confirmation.settle"/>
      </main>
    </UApp>
  </div>
</template>

<style src="~/assets/admin/main.css"></style>
