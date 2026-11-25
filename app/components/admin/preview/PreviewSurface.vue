<script setup lang="ts">
import {notifyPreviewFrame} from '~/utils/admin/preview/frame-state'
const props=defineProps<{error?:string}>()
const failed=ref(false)
let mounted=false
const resolved=ref(false)
function ready(){resolved.value=true;if(mounted&&!failed.value)notifyPreviewFrame('ready')}
function fail(){failed.value=true;notifyPreviewFrame('failed')}
onMounted(()=>{mounted=true;if(props.error)fail();else if(resolved.value&&!failed.value)notifyPreviewFrame('ready')})
function preventNavigation(event:Event){
 const link=event.target instanceof Element?event.target.closest('a'):null
 if(!link)return
 const href=link.getAttribute('href')??''
 if(href.startsWith('#')&&href.length>1){
  const target=document.getElementById(href.slice(1))
  target?.scrollIntoView({block:'start'})
 }
 event.preventDefault()
 event.stopPropagation()
}
</script>

<template>
 <div class="preview-surface" @click.capture="preventNavigation" @auxclick.capture="preventNavigation" @submit.capture.prevent.stop>
  <NuxtErrorBoundary @error="fail">
   <p v-if="error" class="container-shell preview-error" role="alert">{{ error }}</p>
   <Suspense v-else @resolve="ready">
    <div class="preview-content"><slot /></div>
    <template #fallback><p class="container-shell" role="status">正在渲染预览…</p></template>
   </Suspense>
   <template #error><p class="container-shell preview-error" role="alert">当前预览暂时无法渲染。</p></template>
  </NuxtErrorBoundary>
  <slot name="footer" />
 </div>
</template>

<style scoped>
.preview-surface { --header-height:0px; --rule:#bec1c080; color:var(--color-brand-text); background:var(--surface-page); }
.preview-error { padding-block:32px; }
</style>
