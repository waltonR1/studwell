<script setup lang="ts">
import type {TemplateBusinessModule} from '~/utils/admin/website/template-business'
import {ArrowUpRight} from 'lucide-vue-next'
import {moduleManagementPath} from '#shared/config/site-modules'
import {useAdminSessionStore} from '~/stores/admin/session'
const session=useAdminSessionStore()
defineProps<{modules: TemplateBusinessModule[]}>()
</script>

<template>
 <div v-if="modules.length" class="template-business-badges" aria-label="关联业务模块">
  <div v-for="module in modules" :key="module.key" class="template-business-item">
   <span class="template-business-tag" :class="{'is-disabled':!module.enabled}"><span>{{ module.name }}业务</span><span class="template-business-state"><i aria-hidden="true"/>{{ module.enabled?'已启用':'已停用' }}</span></span>
   <NuxtLink :to="module.path" class="template-business-link" :aria-label="'管理'+module.name">业务管理<ArrowUpRight :size="13" aria-hidden="true"/></NuxtLink>
   <NuxtLink v-if="!module.enabled&&session.isRoot" :to="moduleManagementPath" class="template-business-link">前往开启<ArrowUpRight :size="13" aria-hidden="true"/></NuxtLink>
   <span v-else-if="!module.enabled" class="template-business-help">请联系管理员开启</span>
  </div>
 </div>
</template>

<style scoped>
.template-business-badges { display: flex; flex-wrap: wrap; gap: 6px 12px; margin-block: 7px 0; }
.template-business-item { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.template-business-tag { display: inline-flex; align-items: center; gap: 8px; padding: 3px 7px; border: 1px solid #e5eaf0; border-radius: 5px; background: #fff; color: #607084; font-size: 11px; font-weight: 400; line-height: 1.5; white-space: nowrap; }
.template-business-state { display: inline-flex; align-items: center; gap: 4px; padding-left: 8px; border-left: 1px solid #e5eaf0; color: #48816c; }
.template-business-state i { width: 4px; height: 4px; border-radius: 50%; background: currentColor; }
.template-business-tag.is-disabled { background: #fffbf3; border-color: #eee3cd; }
.is-disabled .template-business-state { color: #9c7841; border-color: #eee3cd; }
.template-business-link { display: inline-flex; align-items: center; gap: 2px; color: #71849a; font-size: 12px; line-height: 1.6; text-decoration: none; white-space: nowrap; }
.template-business-link:hover { color: #365d88; text-decoration: underline; }
.template-business-link:focus-visible { outline: 2px solid #527397; outline-offset: 3px; border-radius: 3px; }
.template-business-help { color: #8491a2; font-size: 12px; }
</style>
