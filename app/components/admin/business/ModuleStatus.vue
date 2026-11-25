<script setup lang="ts">
import type {SiteModuleName} from '#shared/config/site-modules'
import {ArrowUpRight, ChevronDown} from 'lucide-vue-next'
import {siteModuleCatalog} from '#shared/config/site-modules'
import {useBusinessModuleStatus} from '~/composables/admin/useBusinessModuleStatus'
import {useAdminBusy,useAdminRefresh} from '~/composables/admin/navigation/useAdminRefresh'
import {useAdminSessionStore} from '~/stores/admin/session'
import type {AdminToastNotification} from '~/types/admin/interaction'
const props=defineProps<{module:SiteModuleName;refreshKey:number}>()
const emit=defineEmits<{changed:[];notify:[notification:AdminToastNotification]}>()
const session=useAdminSessionStore()
const {state,pending,saving,error,notification,blockedByReferences,canRead,canUpdate,load,toggle}=useBusinessModuleStatus(()=>props.module)
const expanded=ref(false)
const busy=useAdminBusy(saving)
const descriptions={news:'发布企业动态、新闻文章与分类。',careers:'发布招聘岗位与任职要求。',inquiries:'接收客户咨询，管理跟进与邮件通知。'}
useAdminRefresh(load)
onMounted(load)
watch([()=>session.generation,canRead,()=>props.refreshKey],()=>{void load()})
onBeforeRouteLeave(()=>!saving.value)
watch(notification,value=>{if(value)emit('notify',value)},{flush:'sync'})
watch(blockedByReferences,value=>{if(value)expanded.value=true},{flush:'sync'})
async function update(){
 if(await toggle())emit('changed')
}
</script>

<template>
 <article v-if="canRead" class="module-row" :aria-label="siteModuleCatalog[module].name" :aria-busy="pending||saving">
  <div class="module-summary">
   <div class="module-identity"><div class="module-title"><h2>{{ siteModuleCatalog[module].name }}</h2><AdminCommonStatusBadge v-if="state" :tone="state.enabled?'success':'neutral'">{{ saving?'正在保存':state.enabled?'已启用':'已停用' }}</AdminCommonStatusBadge><span v-else class="module-muted">{{ pending?'正在加载…':'状态不可用' }}</span></div><p>{{ descriptions[module] }}</p></div>
   <button v-if="state" type="button" class="module-references-button" :disabled="!state.usages.length" :aria-expanded="expanded" :aria-controls="'module-usage-'+module" @click="expanded=!expanded">
    {{ state.usages.length?state.usages.length+' 个页面使用':'暂无页面引用' }}<ChevronDown v-if="state.usages.length" :size="14" :class="{'is-expanded':expanded}" aria-hidden="true"/>
   </button>
   <span v-else class="module-muted">—</span>
   <div class="module-actions">
    <NuxtLink :to="siteModuleCatalog[module].path">业务管理<ArrowUpRight :size="14" aria-hidden="true"/></NuxtLink>
    <AdminCommonSwitchField v-if="state&&canUpdate" :model-value="state.enabled" :label="'启用'+siteModuleCatalog[module].name+'模块'" size="medium" :busy="saving" :disabled="busy||pending" @update:model-value="update"/>
   </div>
  </div>
  <AdminCommonFeedback v-if="error" tone="error">{{ error }}</AdminCommonFeedback>
  <div v-if="state&&expanded&&state.usages.length" :id="'module-usage-'+module" class="module-usage">
   <p class="module-usage-heading"><strong>已发布页面</strong><span>停用前需先移除引用，或下线对应页面。</span></p>
   <ul><li v-for="page in state.usages" :key="page.key">
    <div><strong>{{ page.name }}</strong><span>{{ page.sectionNames.join('、')||'页面业务依赖' }}</span></div>
    <NuxtLink :to="'/admin/website/website_'+encodeURIComponent(page.key)" :aria-label="'维护'+page.name">维护页面<ArrowUpRight :size="14" aria-hidden="true"/></NuxtLink>
   </li></ul>
  </div>
 </article>
</template>

<style scoped>
.module-row { padding-block: 20px; }
.module-row + .module-row { border-top: 1px solid #e9eef4; }
.module-summary { display: grid; grid-template-columns: minmax(220px,1fr) 160px 180px; align-items: center; gap: 24px; }
.module-title { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.module-identity { min-width: 0; }
.module-identity h2 { margin: 0; color: var(--admin-view-ink,#24364b); font-size: 15px; font-weight: 600; }
.module-identity p { margin: 6px 0 0; color: var(--admin-view-muted,#778497); font-size: 12px; line-height: 1.7; }
.module-muted { color: #8a97a8; font-size: 12px; }
.module-actions, .module-actions a, .module-references-button, .module-usage a { display: inline-flex; align-items: center; gap: 4px; }
.module-actions { justify-content: flex-end; gap: 24px; }
.module-actions a, .module-usage a { color: #527397; font-size: 12px; text-decoration: none; white-space: nowrap; }
.module-actions a:hover, .module-usage a:hover { text-decoration: underline; }
.module-references-button { width: fit-content; padding: 6px 8px; border: 1px solid transparent; border-radius: 6px; background: transparent; color: #60768d; font-size: 12px; text-align: left; cursor: pointer; }
.module-references-button:not(:disabled):hover { background: #f2f5f9; color: #365d88; }
.module-references-button:disabled { color: #8a97a8; cursor: default; }
.module-references-button svg { transition: transform .15s ease; }
.module-references-button svg.is-expanded { transform: rotate(180deg); }
.module-actions a:focus-visible, .module-usage a:focus-visible, .module-references-button:focus-visible { outline: 2px solid #527397; outline-offset: 4px; border-radius: 3px; }
.module-usage { margin-top: 16px; padding: 16px 18px; background: #f8fafc; border: 0; border-radius: 8px; }
.module-usage-heading { display: flex; align-items: baseline; flex-wrap: wrap; gap: 12px; }
.module-usage p { margin: 0 0 12px; color: #778497; font-size: 12px; line-height: 1.7; }
.module-usage ul { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px 16px; list-style: none; margin: 0; padding: 0; }
.module-usage li { display: flex; align-items: center; justify-content: space-between; gap: 20px; min-width: 0; padding: 12px 14px; background: #fff; border: 1px solid #e9eef4; border-radius: 6px; }
.module-usage li > div { display: grid; gap: 3px; min-width: 0; }
.module-usage strong { color: #344a63; font-size: 13px; font-weight: 550; overflow-wrap: anywhere; }
.module-usage li span { color: #8491a2; font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
@media (max-width: 1000px) {
 .module-summary { grid-template-columns: minmax(0,1fr) auto; gap: 12px 20px; }
 .module-identity { grid-column: 1 / -1; }
 .module-usage ul { grid-template-columns: minmax(0,1fr); }
}
</style>
