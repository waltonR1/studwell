<script setup lang="ts">
import {storeToRefs} from 'pinia'
import {useAdminWebsitePagesStore} from '~/stores/admin/website-pages'
import type {SiteLocale} from '#shared/schemas/admin/site-settings'
const store=useAdminWebsitePagesStore(),{draft,busy,canEdit}=storeToRefs(store)
defineProps<{locale:SiteLocale}>()

</script>
<template>
 <section v-if="draft" class="admin-section site-card"><h3>页面设置</h3>
  <div class="site-fields">
   <label class="site-wide">页面显示名称<UInput v-model="draft.settings.displayName[locale]" :disabled="busy||!canEdit" :ui="{base:'admin-input'}" :maxlength="500"/></label>
   <p class="site-wide admin-help">公开路径由「全站维护 → 路由与 SEO」独立发布。</p>
   <div  class="site-wide page-scene-settings">
    <div class="page-scene-controls"><div class="site-check"><AdminCommonSwitchField :model-value="draft.settings.sceneEnabled" label="场景切换" :disabled="busy||!canEdit" @update:model-value="store.setSceneEnabled($event)"/><span>场景切换</span></div>
     <label v-if="draft.settings.sceneEnabled" class="page-scene-duration"><span>切换时长（秒）</span><UInput type="number" class="page-scene-input" aria-label="切换动画时长（秒）" aria-describedby="scene-duration-help" :model-value="String(draft.settings.sceneTransitionSeconds??'')" :min="0.1" :max="3" :step="0.01" :disabled="busy||!canEdit" :ui="{base:'admin-input'}" @update:model-value="draft.settings.sceneTransitionSeconds=$event===''?null:Number($event)"/></label>
    </div>
    <p id="scene-duration-help" class="admin-help">{{ draft.settings.sceneEnabled?'切换动画时长可设为 0.1–3 秒，默认 0.42 秒。':'关闭时，区块按顺序连续滚动。' }}</p>
   </div>
  </div>
 </section>
</template>

<style scoped>
.page-scene-settings { display: grid; gap: 8px; }
.page-scene-controls { display: flex; align-items: center; flex-wrap: wrap; gap: 16px 28px; }
.page-scene-duration { display: flex; align-items: center; gap: 10px; }
.page-scene-duration > span { white-space: nowrap; }
.page-scene-input { width: 120px; }
.page-scene-settings .admin-help { margin: 0; }
</style>
