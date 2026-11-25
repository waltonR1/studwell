<!-- 官网链接目标选择：消费页面、锚点和业务目标投影，不负责查询或页面草稿。 -->
<script setup lang="ts">
import {computed,nextTick,ref,watch} from 'vue'
import {ArrowLeft,Check,ChevronDown,Link} from 'lucide-vue-next'
import type {SiteLocale} from '#shared/schemas/admin/site-settings'
import type {SiteTarget} from '#shared/types/admin/site-settings'
import type {LinkTarget} from '#shared/schemas/website/link-target'
import {sameLinkTarget} from '#shared/utils/website/link-target'
import {isSiteLinkAddress} from '#shared/utils/website/site-link'
import {orderedSiteTargets} from '~/utils/admin/site-settings/targets'

const props=withDefaults(defineProps<{
 modelValue:LinkTarget|null;label:string;locale:SiteLocale;targets:SiteTarget[]
 allowEmpty?:boolean;loading?:boolean;error?:string;disabled?:boolean;max?:number
}>(),{max:2000})
const emit=defineEmits<{'update:modelValue':[value:LinkTarget|null];retry:[]}>()
const open=ref(false),mode=ref<'targets'|'custom'>('targets'),query=ref(''),address=ref(''),submitted=ref(false)
const searchInput=ref<HTMLInputElement|null>(null),addressInput=ref<HTMLInputElement|null>(null),choices=ref<HTMLElement|null>(null)
const locked=computed(()=>!!(props.disabled||props.loading||props.error))
const target=computed(()=>props.modelValue)
const hasTarget=computed(()=>!!target.value&&(!('resourceId' in target.value)||!!target.value.resourceId))
const ordered=computed(()=>orderedSiteTargets(props.targets))
const known=computed(()=>{const value=target.value;return value&&('resourceId' in value)?ordered.value.find(item=>sameLinkTarget(value,item.target)):undefined})
const selectedLabel=computed(()=>{
 if(props.loading)return '正在加载跳转目标'
 if(!hasTarget.value)return props.allowEmpty?'不跳转':'选择跳转目标'
 if(target.value?.type==='custom')return target.value.value||'自定义链接'
 if(!known.value)return '当前目标不可用，请重新选择'
 const item=known.value,page=ordered.value.find(page=>page.target.type==='page'&&page.resourceId===item.resourceId)
 return item.target.type==='page'?item.label[props.locale]:[page?.label[props.locale],item.label[props.locale]].filter(Boolean).join(' / ')
})
const typeLabels:Record<string,string>={page:'页面',anchor:'区块'}
const groups=computed(()=>{
 const term=query.value.trim().toLocaleLowerCase()
 return ordered.value.filter(item=>item.target.type==='page').flatMap(page=>{
  const items=ordered.value.filter(item=>item.resourceId===page.resourceId)
  const pageMatches=!term||(page.label[props.locale]+' '+page.path).toLocaleLowerCase().includes(term)
  const matching=pageMatches?items:items.filter(item=>(item.label[props.locale]+' '+item.path+' '+(typeLabels[item.target.type]??'业务链接')).toLocaleLowerCase().includes(term))
  if(!matching.length)return []
  return [{page,items:matching.some(item=>item.key===page.key)?matching:[page,...matching]}]
 })
})
const invalidAddress=computed(()=>submitted.value&&!isSiteLinkAddress(address.value.trim()))
function isSelected(item:SiteTarget){return !!target.value&&'resourceId' in target.value&&sameLinkTarget(target.value,item.target)}
function choiceLabel(item:SiteTarget,page:SiteTarget){return item.target.type==='page'?page.label[props.locale]+' / 页面':page.label[props.locale]+' / '+item.label[props.locale]}
function choose(item:SiteTarget){emit('update:modelValue',{...item.target});open.value=false}
function chooseNone(){emit('update:modelValue',null);open.value=false}
async function editCustom(){
 mode.value='custom';submitted.value=false
 address.value=target.value?.type==='custom'?target.value.value:isSiteLinkAddress(query.value.trim())?query.value.trim():''
 await nextTick();addressInput.value?.focus()
}
async function showTargets(){mode.value='targets';submitted.value=false;await nextTick();searchInput.value?.focus()}
function confirmCustom(){
 submitted.value=true
 const value=address.value.trim()
 if(!isSiteLinkAddress(value)||locked.value)return
 emit('update:modelValue',{type:'custom',value});open.value=false
}
function moveFocus(event:KeyboardEvent){
 if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return
 if(event.target===searchInput.value&&['Home','End'].includes(event.key))return
 const buttons=Array.from(choices.value?.querySelectorAll<HTMLButtonElement>('[data-link-choice]')??[])
 if(!buttons.length)return
 event.preventDefault()
 const index=buttons.findIndex(button=>button===event.target)
 const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:event.key==='ArrowUp'?(index<=0?buttons.length-1:index-1):(index+1)%buttons.length
 buttons[next]?.focus()
}
watch(open,async value=>{
 if(!value)return
 query.value='';submitted.value=false
 mode.value=target.value?.type==='custom'?'custom':'targets'
 address.value=target.value?.type==='custom'?target.value.value:''
 await nextTick()
 if(mode.value==='custom')addressInput.value?.focus()
 else searchInput.value?.focus()
})
watch(locked,value=>{if(value)open.value=false})
</script>
<template>
 <div class="link-target-select">
  <UPopover v-model:open="open" portal=".admin-shell[data-admin-shell]" :content="{align:'start',sideOffset:6,collisionPadding:12}" :ui="{content:'link-target-panel'}">
   <button type="button" class="link-target-trigger" :class="{'link-target-placeholder':!hasTarget||loading}" :aria-label="label" :title="selectedLabel" :disabled="locked">
    <span>{{ selectedLabel }}</span><ChevronDown :size="14" aria-hidden="true"/>
   </button>
   <template #content>
    <div v-if="mode==='targets'" class="link-target-browser" :aria-label="label+'选择面板'">
     <div class="link-target-search">
      <input ref="searchInput" class="admin-input" type="search" :value="query" aria-label="搜索页面、区块或新闻分类" placeholder="搜索页面、区块、分类或路径" autocomplete="off" @input="query=($event.target as HTMLInputElement).value" @keydown="moveFocus">
     </div>
     <div ref="choices" class="link-target-options" @keydown="moveFocus">
      <button v-if="allowEmpty" type="button" class="link-target-option link-target-none" data-link-choice aria-label="不跳转" @click="chooseNone">
       <span>不跳转</span><Check v-if="!hasTarget" :size="16" aria-hidden="true"/>
      </button>
      <div v-for="group in groups" :key="group.page.key" class="link-target-group" role="group" :aria-label="group.page.label[locale]">
       <button v-for="item in group.items" :key="item.key" type="button" class="link-target-option" :class="{'link-target-child':item.target.type!=='page','link-target-selected':isSelected(item)}" data-link-choice :aria-label="choiceLabel(item,group.page)" :title="item.path" @click="choose(item)">
        <span class="link-target-option-copy"><span class="link-target-option-name">{{ item.label[locale] }}</span><span v-if="item.target.type==='page'" class="link-target-path">{{ item.path }}</span></span>
        <span class="link-target-kind">{{ typeLabels[item.target.type] }}</span><Check v-if="isSelected(item)" :size="16" aria-hidden="true"/>
       </button>
      </div>
      <p v-if="!groups.length" class="link-target-empty">没有匹配的页面或位置</p>
     </div>
     <div class="link-target-footer"><button type="button" class="link-target-custom-action" @click="editCustom"><Link :size="16" aria-hidden="true"/>自定义链接</button></div>
    </div>
    <div v-else class="link-target-custom-editor" :aria-label="label+'自定义链接面板'">
     <button type="button" class="link-target-back" @click="showTargets"><ArrowLeft :size="15" aria-hidden="true"/>返回目标列表</button>
     <label class="link-target-address-label">链接地址<input ref="addressInput" class="admin-input" type="text" :value="address" :aria-label="label+'地址'" :aria-invalid="invalidAddress" :maxlength="Math.min(max,2000)" placeholder="https://example.com 或 /站内路径" autocomplete="off" @input="address=($event.target as HTMLInputElement).value" @keydown.enter.prevent="confirmCustom"></label>
     <p class="link-target-address-help" :class="{'link-target-invalid':invalidAddress}" :role="invalidAddress?'alert':undefined">{{ invalidAddress?'请输入有效的 HTTP(S) 网址或以 / 开头的站内路径。':'支持 HTTP(S) 网址或以 / 开头的站内路径。' }}</p>
     <div class="link-target-editor-actions"><button type="button" class="admin-button" @click="open=false">取消</button><button type="button" class="admin-button admin-button-primary" :disabled="locked" @click="confirmCustom">使用此链接</button></div>
    </div>
   </template>
  </UPopover>
  <AdminCommonFeedback v-if="error" tone="error">{{ error }}<UButton class="admin-button" :disabled="disabled||loading" @click="emit('retry')">重试</UButton></AdminCommonFeedback>
 </div>
</template>
<style scoped>
.link-target-select {width:100%;min-width:0}
.link-target-trigger {display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-width:0;height:40px;padding:8px 12px;border:1px solid #dbe2eb;border-radius:8px;background:#fff;color:#526278;font:inherit;font-size:13px;text-align:left;cursor:pointer}
.link-target-trigger > span {min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.link-target-trigger > svg {flex:none;color:#8a99ac}
.link-target-placeholder {color:#8a99ac}
.link-target-trigger:focus-visible,.link-target-trigger[data-state='open'] {outline:none;border-color:#779abd;box-shadow:0 0 0 3px #eaf1f9}
.link-target-trigger:disabled {cursor:not-allowed;opacity:.6}
.link-target-browser {display:flex;flex-direction:column;min-height:0;max-height:inherit}
.link-target-search {position:relative;flex:none;padding:10px;border-bottom:1px solid #e8edf4}
.link-target-search .admin-input {width:100%;min-width:0;box-sizing:border-box}
.link-target-options {overflow-y:auto;overscroll-behavior:contain;min-height:0;padding:5px;flex:1}
.link-target-group + .link-target-group,.link-target-none + .link-target-group {border-top:1px solid #edf1f6;margin-top:5px;padding-top:5px}
.link-target-option {display:flex;align-items:center;gap:10px;width:100%;min-width:0;min-height:36px;padding:8px 10px;border:0;border-radius:6px;background:transparent;color:#526278;font:inherit;font-size:13px;text-align:left;cursor:pointer}
.link-target-option:hover,.link-target-option:focus-visible {outline:none;background:#f0f5fb;color:#245886}
.link-target-selected {background:#edf3fa;color:#245886}
.link-target-option-copy {display:flex;flex:1;flex-direction:column;gap:3px;min-width:0}
.link-target-option-name,.link-target-path {overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.link-target-option:not(.link-target-child) .link-target-option-name {font-weight:600}
.link-target-path {color:#8a99ac;font-size:12px}
.link-target-child {padding-left:28px}
.link-target-kind {flex:none;padding:2px 5px;border-radius:4px;background:#f2f5f9;color:#8090a4;font-size:11px;white-space:nowrap}
.link-target-option > svg {flex:none}
.link-target-none {justify-content:space-between}
.link-target-empty {padding:20px 10px;color:#8a99ac;text-align:center;font-size:13px}
.link-target-footer {flex:none;padding:6px;border-top:1px solid #e8edf4}
.link-target-custom-action,.link-target-back {display:flex;align-items:center;gap:8px;border:0;background:transparent;color:#245886;font:inherit;font-size:13px;cursor:pointer}
.link-target-custom-action {width:100%;padding:9px 10px;border-radius:6px;text-align:left}
.link-target-custom-action:hover,.link-target-custom-action:focus-visible {outline:none;background:#f0f5fb}
.link-target-custom-editor {padding:14px;overflow-y:auto;max-height:inherit;box-sizing:border-box}
.link-target-back {padding:0;margin-bottom:18px}
.link-target-address-label {display:flex;flex-direction:column;gap:8px;color:#526278;font-size:13px}
.link-target-address-label .admin-input {width:100%;min-width:0;box-sizing:border-box}
.link-target-address-help {margin:8px 0 0;color:#8a99ac;font-size:12px;line-height:1.6}
.link-target-invalid {color:#c34242}
.link-target-editor-actions {display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
</style>
<style>
.admin-shell[data-admin-shell] .link-target-panel {z-index:90;display:flex;flex-direction:column;width:var(--reka-popover-trigger-width);min-width:min(320px,calc(100vw - 32px));max-width:min(560px,calc(100vw - 32px));max-height:min(420px,var(--reka-popover-content-available-height,420px));overflow:hidden;border:1px solid #e1e8f1;border-radius:10px;background:#fff;box-shadow:0 10px 32px #24364b1f;box-sizing:border-box}
</style>
