<!-- 历史整页预览复用现有 iframe 预览容器和官网区块装配；只读快照，不覆盖工作草稿。 -->
<script setup lang="ts">
import {storeToRefs} from 'pinia'
import {useAdminWebsitePagesStore} from '~/stores/admin/website-pages'
import type {SiteLocale} from '#shared/schemas/admin/site-settings'
import {siteLocaleNames} from '#shared/config/admin/site-settings'
import {formatBeijingTime} from '#shared/utils/beijing-time'
import PreviewDialog from '~/components/admin/preview/PreviewDialog.vue'

const props=defineProps<{locale:SiteLocale;releaseId:string;busy?:boolean;canPublish?:boolean}>()
const emit=defineEmits<{back:[];restore:[]}>()
const store=useAdminWebsitePagesStore(),route=useRoute()
const {detail,detailPending,detailError}=storeToRefs(store)
const previewLocale=ref<string>(props.locale)
const load=()=>store.loadDetail(props.releaseId)
onMounted(load)
onBeforeUnmount(()=>store.closeDetail())
const languages=computed(()=>{
 const snapshot=detail.value?.content as {settings?:{displayName?:Record<string,string>};sections?:Array<{visible:boolean;localized:Record<string,unknown>}>}|undefined
 const sections=snapshot?.sections?.filter(section=>section.visible)??[]
 return Object.entries(siteLocaleNames).filter(([locale])=>sections.length?sections.every(section=>section.localized[locale]!==undefined):snapshot?.settings?.displayName?.[locale]!==undefined).map(([value,label])=>({value,label}))
})
watch(languages,items=>{if(items.length&&!items.some(item=>item.value===previewLocale.value))previewLocale.value=items[0]!.value},{immediate:true})
const src=computed(()=>detail.value&&languages.value.length?'/admin/website/'+encodeURIComponent(String(route.params.code))+'/preview?'+new URLSearchParams({mode:'history',releaseId:props.releaseId,locale:previewLocale.value}):undefined)
const description=computed(()=>detail.value?formatBeijingTime(detail.value.createdAt)+' · '+(detail.value.isCurrent?'当前发布版本':'历史版本'):'正在读取发布记录…')
</script>
<template>
 <PreviewDialog :open="true" :src="src" :title="(store.record?.name??'页面')+' · 历史预览'" :description="description" :busy="busy" close-label="返回发布记录" @close="emit('back')">
  <template #toolbar>
   <AdminWebsiteSharedPublicationAuthor v-if="detail" :author="detail" />
   <AdminCommonSelectField v-if="languages.length" v-model="previewLocale" :items="languages" label="预览语言" :body-lock="false" :disabled="busy" />
   <UBadge v-if="detail" :color="detail.isCurrent?'primary':'neutral'" variant="soft">{{ detail.isCurrent?'当前发布':'历史版本' }}</UBadge>
   <AdminCommonDataState v-if="detailError" state="error" title="历史版本读取失败" :description="detailError"><template #action><UButton class="admin-button" @click="load">重试</UButton></template></AdminCommonDataState>
   <p v-else-if="detailPending" class="admin-help" role="status">正在读取历史版本…</p>
   <p v-else-if="detail&&!languages.length" class="admin-help" role="alert">此版本没有可完整预览的语言内容。</p>
  </template>
  <template #actions="{ready}">
   <UButton v-if="detail&&!detail.isCurrent&&canPublish" class="admin-button admin-button-primary" :disabled="busy||detailPending||!ready" @click="emit('restore')">回滚到此版本</UButton>
  </template>
 </PreviewDialog>
</template>
