<script setup lang="ts">
import {companyBrand} from '~/config/admin/brand'
import {ArrowUpRight, ChartNoAxesCombined, LayoutGrid, ShieldCheck, UserRound} from 'lucide-vue-next'
import {dashboardMetricLink} from '~/utils/admin/dashboard/links'
import {beijingDate, formatBeijingTime} from '#shared/utils/beijing-time'
import {useAdminDashboardStore} from '~/stores/admin/dashboard'
import {useAdminSessionStore} from '~/stores/admin/session'
import {storeToRefs} from 'pinia'
import {useAdminRefresh} from '~/composables/admin/navigation/useAdminRefresh'
const store = useAdminDashboardStore(), auth = useAdminSessionStore(), route = useRoute()
const {session} = storeToRefs(auth)

const {
  overview,
  error,
  pending,
  links,
  metrics,
  userName,
  navigationIcons,
  navigationItems,
} = storeToRefs(store)
async function refreshPage() { await store.refresh().catch(() => {}) }
useAdminRefresh(() => store.refresh())
onBeforeUnmount(() => store.leave())
await callOnce('admin-dashboard:' + auth.generation + ':' + route.fullPath, () => store.load(), {mode: 'navigation'})
</script>

<template>
  <section class="admin-module dashboard">
    <header class="dashboard-welcome">
      <div class="welcome-copy">
        <span class="eyebrow">{{ companyBrand.name }} · 管理工作台</span>
        <h1>欢迎回来，{{ userName }}</h1>
        <p>从这里了解今日动态，开始你的管理工作。</p>
      </div>
      <div class="welcome-mark" aria-hidden="true">
        <LayoutGrid/>
        <span>工作台 / OVERVIEW</span></div>
    </header>

    <AdminCommonDataState v-if="pending" state="loading" title="正在读取首页数据…"/>
    <AdminCommonFeedback v-else-if="error" title="首页数据加载失败">{{ error }}
      <template #action>
        <UButton class="admin-button" @click="refreshPage">重试</UButton>
      </template>
    </AdminCommonFeedback>
    <template v-else>
      <section class="overview-section" aria-labelledby="overview-heading">
        <div class="section-heading">
          <div><h2 id="overview-heading">数据概览</h2>
            <p>账号与系统运行数据</p></div>
          <span v-if="overview" class="update-time">更新于 {{ formatBeijingTime(overview.updatedAt) }}</span>
        </div>
        <div v-if="metrics.length" class="dashboard-grid">
          <article v-for="definition in metrics" :key="definition.key" class="metric-card"
                   :class="{ 'metric-attention': definition.key === 'loginFailed' || definition.key === 'securityToday' }">
            <div class="metric-heading"><h3>{{ definition.label }}</h3>
              <ChartNoAxesCombined aria-hidden="true"/>
            </div>
            <p class="metric-value">{{
                overview!.stats[definition.key]?.toLocaleString('zh-CN')
              }}<span>{{
                  definition.key === 'users' ? '个账号' : definition.key === 'roles' ? '个角色' : definition.key === 'dictionaries' ? '个类型' : '条记录'
                }}</span></p>
            <p class="metric-note">{{ definition.note }}</p>
            <NuxtLink v-if="dashboardMetricLink(definition, navigationItems)" class="metric-link"
                      :to="dashboardMetricLink(definition, navigationItems)!">
              查看{{ definition.label.startsWith('今日') ? '记录' : '列表' }}
              <ArrowUpRight aria-hidden="true"/>
            </NuxtLink>
          </article>
        </div>
        <div v-else class="dashboard-empty">
          <ChartNoAxesCombined aria-hidden="true"/>
          <p>{{ overview ? '暂无已授权的统计项。' : '尚未获得首页统计权限，可通过下方快捷入口开展工作。' }}</p></div>
      </section>

      <div class="dashboard-bottom">
        <section class="workspace-panel" aria-labelledby="links-heading">
          <div class="section-heading">
            <div><h2 id="links-heading">快捷入口</h2>
              <p>快速前往已授权的管理模块</p></div>
            <span class="count-badge">{{ links.length }} 个模块</span></div>
          <ul v-if="links.length" class="dashboard-links">
            <li v-for="link in links" :key="link.path">
              <NuxtLink :to="link.path" class="shortcut"><span class="shortcut-icon"><AdminCommonMenuIcon
                  :icon-key="navigationIcons.get(link.id) ?? 'folder'" aria-hidden="true"/></span><span>{{
                  link.name
                }}</span>
                <ArrowUpRight class="shortcut-arrow" aria-hidden="true"/>
              </NuxtLink>
            </li>
          </ul>
          <p v-else class="empty-copy">暂无可见入口，请联系管理员核对菜单授权。</p>
        </section>
        <aside class="workspace-panel account-panel" aria-labelledby="account-heading">
          <div class="section-heading">
            <div><h2 id="account-heading">当前账号</h2>
              <p>本次登录身份</p></div>
            <ShieldCheck class="account-shield" aria-hidden="true"/>
          </div>
          <div class="account-identity"><span class="account-avatar"><UserRound aria-hidden="true"/></span>
            <div><strong>{{ userName }}</strong><span>{{ session?.user?.username ?? '—' }}</span></div>
          </div>
          <dl class="account-details">
            <div>
              <dt>账号身份</dt>
              <dd>{{ session?.user?.isRoot ? '超级管理员' : '管理员' }}</dd>
            </div>
            <div>
              <dt>可用模块</dt>
              <dd>{{ links.length }} 个</dd>
            </div>
            <div v-if="overview">
              <dt>统计日期</dt>
              <dd>{{ beijingDate(new Date(overview.range.start)) }}</dd>
            </div>
          </dl>
          <p class="account-tip">页面内容根据当前账号的菜单授权与操作权限展示。</p>
        </aside>
      </div>
    </template>
  </section>
</template>

<style scoped>
.dashboard {
  --dashboard-blue: #174b84;
}

.dashboard-welcome {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  overflow: hidden;
  padding: 32px;
  margin-bottom: 30px;
  border: 1px solid #dce6f0;
  border-radius: 14px;
  background: linear-gradient(110deg, #edf3fa, #f8fbfd);
}

.eyebrow {
  color: #52718e;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 2px;
}

.dashboard-welcome h1 {
  margin: 12px 0 8px;
  color: #183a5e;
  font-size: clamp(22px, 2vw, 30px);
  letter-spacing: -.5px;
}

.dashboard-welcome p {
  margin: 0;
  color: #62758a;
}

.welcome-mark {
  display: grid;
  justify-items: end;
  gap: 14px;
  flex-shrink: 0;
  color: #7d9ab6;
}

.welcome-mark svg {
  width: 48px;
  height: 48px;
  stroke-width: 1;
}

.welcome-mark span {
  font-size: 10px;
  letter-spacing: 2px;
}

.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.section-heading h2 {
  margin: 0;
  color: #26384c;
  font-size: 17px;
  font-weight: 650;
}

.section-heading p {
  margin: 5px 0 0;
  color: #7b8999;
  font-size: 12px;
}

.update-time {
  color: #7b8999;
  font-size: 11px;
  text-align: right;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.metric-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 20px;
  border: 1px solid #e1e7ef;
  border-radius: 12px;
  background: #fff;
}

.metric-heading {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
}

.metric-heading h3 {
  margin: 0;
  color: #627185;
  font-size: 13px;
  font-weight: 500;
}

.metric-heading > svg {
  width: 18px;
  height: 18px;
  color: #8ba4bf;
}

.metric-value {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: baseline;
  margin: 16px 0 10px;
  color: #203b5a;
  font-size: 34px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.metric-value span {
  color: #8a96a5;
  font-size: 11px;
  font-weight: 400;
}

.metric-note {
  flex: 1;
  margin: 0 0 18px;
  color: #8591a0;
  font-size: 11px;
}

.metric-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #edf0f4;
  color: var(--dashboard-blue);
  font-size: 12px;
  text-decoration: none;
}

.metric-link:hover {
  text-decoration: underline;
}

.metric-link svg {
  width: 15px;
  height: 15px;
}

.metric-attention .metric-heading > svg {
  color: #bc8b4d;
}

.dashboard-bottom {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr);
  align-items: start;
  gap: 20px;
  margin-top: 28px;
}

.workspace-panel {
  min-width: 0;
  padding: 24px;
  border: 1px solid #e1e7ef;
  border-radius: 12px;
  background: white;
}

.count-badge {
  flex-shrink: 0;
  border-radius: 5px;
  padding: 4px 8px;
  background: #f1f5f9;
  color: #718196;
  font-size: 11px;
}

.dashboard-links {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.shortcut {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 66px;
  padding: 12px;
  border: 1px solid #e9edf2;
  border-radius: 9px;
  color: #405166;
  text-decoration: none;
  transition: background .15s, border-color .15s;
}

.shortcut:hover {
  border-color: #b8cce1;
  background: #f5f9fd;
  color: var(--dashboard-blue);
}

.shortcut > span:nth-child(2) {
  overflow-wrap: anywhere;
}

.shortcut-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 8px;
  background: #edf3fa;
  color: #47749f;
}

.shortcut-icon :deep(svg) {
  width: 18px;
  height: 18px;
}

.shortcut-arrow {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  margin-left: auto;
  color: #8d9caf;
}

.account-shield {
  width: 21px;
  height: 21px;
  color: #7e9cba;
}

.account-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 22px;
  border-bottom: 1px solid #edf0f4;
}

.account-avatar {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  background: #edf3fa;
  color: #47749f;
  border-radius: 12px;
}

.account-avatar svg {
  width: 22px;
  height: 22px;
}

.account-identity > div {
  display: grid;
  gap: 3px;
  min-width: 0;
  overflow-wrap: anywhere;
}

.account-identity strong {
  color: #2d435c;
  font-weight: 600;
}

.account-identity div span {
  color: #8591a0;
  font-size: 12px;
}

.account-details {
  display: grid;
  gap: 14px;
  margin: 20px 0;
  font-size: 12px;
}

.account-details > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.account-details dt {
  color: #8591a0;
}

.account-details dd {
  margin: 0;
  color: #405166;
  text-align: right;
}

.account-tip {
  margin: 0;
  padding: 12px;
  border-radius: 6px;
  background: #f6f8fb;
  color: #7b8999;
  font-size: 11px;
}

.dashboard-empty {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 28px;
  border: 1px dashed #cdd9e5;
  border-radius: 12px;
  color: #718196;
  background: #fff;
}

.dashboard-empty svg {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.dashboard-empty p, .empty-copy {
  margin: 0;
  color: #718196;
}

@media (min-width: 1600px) {
  .dashboard-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 1200px) {
  .dashboard-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-bottom {
    grid-template-columns: minmax(0, 1.5fr) minmax(240px, 1fr);
  }

  .dashboard-links {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 700px) {
  .dashboard-welcome {
    padding: 24px;
    margin-bottom: 24px;
  }

  .welcome-mark {
    display: none;
  }

  .dashboard-bottom {
    grid-template-columns: minmax(0, 1fr);
  }

  .workspace-panel {
    padding: 20px;
  }

  .section-heading {
    align-items: flex-start;
  }

  .update-time {
    max-width: 135px;
  }
}

@media (max-width: 420px) {
  .dashboard-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .shortcut {
    transition: none;
  }
}
</style>
