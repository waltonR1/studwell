<script setup lang="ts">
import {previewFrameState} from '~/utils/admin/preview/frame-state'
import {useAdminSessionStore} from '~/stores/admin/session'
const session=useAdminSessionStore()
const props=defineProps<{open:boolean;src?:string;title:string;description?:string;busy?:boolean;closeLabel?:string;article?:{content:unknown;locale:string}}>()
const emit=defineEmits<{close:[]}>()
const device=ref<'desktop'|'mobile'>('desktop')
const frame=ref<HTMLIFrameElement>()
watch(()=>props.open,open=>{if(open)device.value='desktop'})
watch(()=>session.generation,()=>emit('close'))

const status=ref<'loading'|'ready'|'failed'>('loading')
const revision=ref(0),articleReady=ref(false)
let timer:ReturnType<typeof setTimeout>|undefined
function start(){
 clearTimeout(timer)
 status.value='loading';articleReady.value=false
 if(import.meta.client&&props.open&&props.src)timer=setTimeout(fail,30000)
}
function fail(){clearTimeout(timer);status.value='failed'}
function retry(){revision.value++;start()}
watch([()=>props.open,()=>props.src],start,{immediate:true})
function postArticle(){
 if(!props.open||!props.article||!articleReady.value||!frame.value?.contentWindow)return
 frame.value.contentWindow.postMessage({type:'website-article-preview',article:JSON.parse(JSON.stringify(props.article))},window.location.origin)
}
function receive(event:MessageEvent){
 if(!props.open||event.origin!==window.location.origin||!frame.value?.contentWindow||event.source!==frame.value.contentWindow)return
 if(event.data?.type==='website-article-preview-ready'){articleReady.value=true;postArticle();return}
 const state=previewFrameState(event.data)
 if(state){clearTimeout(timer);status.value=state}
}
watch(()=>props.article,postArticle,{deep:true})
onMounted(()=>window.addEventListener('message',receive))
onBeforeUnmount(()=>{clearTimeout(timer);window.removeEventListener('message',receive)})
</script>

<template>
 <div class="website-preview-dialog">
  <AdminCommonDialog :open="open" :title="title" :description="description" :busy="busy" size="preview" @close="emit('close')">
   <div class="admin-toolbar" role="group" aria-label="预览设备">
    <UButton class="admin-button" :class="{'admin-button-primary':device==='desktop'}" :aria-pressed="device==='desktop'" @click="device='desktop'">电脑</UButton>
    <UButton class="admin-button" :class="{'admin-button-primary':device==='mobile'}" :aria-pressed="device==='mobile'" @click="device='mobile'">手机</UButton>
    <span class="admin-help">预览宽度：{{ device==='desktop'?'1600':'390' }} px</span>
    <slot name="toolbar" />
   </div>
   <p v-if="src&&status==='loading'" class="admin-help" role="status">正在加载预览…</p>
   <div v-else-if="status==='failed'" class="admin-help" role="alert">预览加载失败，请检查内容与权限后重试。<UButton class="admin-button" @click="retry">重新加载</UButton></div>
   <div v-show="status!=='failed'" class="website-preview-stage">
    <iframe v-if="open&&src" ref="frame" :key="src+':'+revision" class="website-preview-frame" :class="{'is-mobile':device==='mobile'}" :src="src" :title="title" @error="fail" sandbox="allow-scripts allow-same-origin" />
   </div>
   <template #actions><slot name="actions" :ready="status==='ready'" /><UButton class="admin-button" :disabled="busy" @click="emit('close')">{{ closeLabel??'关闭' }}</UButton></template>
  </AdminCommonDialog>
 </div>
</template>

<style scoped>
.website-preview-stage { overflow-x:auto; margin-top:16px; padding:1px; background:#f3f5f8; }
.website-preview-frame { display:block; width:1600px; max-width:none; height:60dvh; min-height:360px; margin-inline:auto; border:0; outline:1px solid #d5deeb; background:white; }
.website-preview-frame.is-mobile { width:390px; }
</style>
