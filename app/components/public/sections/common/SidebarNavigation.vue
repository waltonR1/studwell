<!-- 页内目录：读取同页区块标题和锚点，不参与页面装配。 -->
<script setup lang="ts">
import {usePublishedSection,useCurrentPublicPage} from '~/composables/public/runtime/usePublicPage'
const {section,t:contentText}=usePublishedSection()
const page=useCurrentPublicPage(),route=useRoute(),expanded=ref(false)
const panelId=computed(()=>'sidebar-navigation-'+section.value!.id)
const links=computed(()=>(page?.sections.value??[]).flatMap(item=>{
 if(item.id===section.value?.id)return[]
 const copy=item.content.copy
 const title=typeof item.content.title==='string'?item.content.title:copy&&typeof copy==='object'&&!Array.isArray(copy)&&'title' in copy&&typeof copy.title==='string'?copy.title:''
 return title.trim()?[{id:item.id,title,href:'#'+encodeURIComponent(item.anchorKey||item.id)}]:[]
}))
watch(()=>route.fullPath,()=>{expanded.value=false})
</script>
<template>
 <section v-if="links.length" class="sidebar-navigation">
  <button class="sidebar-navigation-toggle" type="button" :aria-expanded="expanded" :aria-controls="panelId" @click="expanded=!expanded">{{ contentText('title') }} <span aria-hidden="true">{{ expanded?'−':'+' }}</span></button>
  <nav :id="panelId" class="sidebar-navigation-panel" :class="{'is-expanded':expanded}" :aria-label="contentText('title')">
   <h2>{{ contentText('title') }}</h2><a v-for="link in links" :key="link.id" :href="link.href" :aria-current="route.hash===link.href?'location':undefined">{{ link.title }}</a>
  </nav>
 </section>
</template>
<style scoped>
.sidebar-navigation{position:fixed;top:calc(var(--header-height) + 69px);right:max(40px,calc((100vw - 1250px)/2 + 60px));width:166px;max-height:calc(100dvh - var(--header-height) - 100px);overflow:auto;box-sizing:border-box;border-left:1px solid #e7ebf2;padding-left:22px;font-size:14px;color:#7b879c;z-index:2}
.sidebar-navigation-toggle{display:none}nav h2{font:inherit;font-weight:500;color:#27334c;margin:0 0 18px}nav a{display:block;line-height:1.8;margin:12px 0;color:inherit;text-decoration:none}nav a:hover,nav a[aria-current=location]{color:var(--color-brand-red,#244fd8)}.sidebar-navigation :is(a,button):focus-visible{outline:2px solid currentColor;outline-offset:3px}
@media(max-width:1000px){.sidebar-navigation{position:relative;inset:auto;width:auto;max-height:none;overflow:visible;margin:24px 40px;padding-left:20px}.sidebar-navigation-toggle{display:flex;justify-content:space-between;align-items:center;width:100%;padding:8px 0;border:0;background:transparent;color:#27334c;font:inherit;cursor:pointer}.sidebar-navigation-panel{display:none}.sidebar-navigation-panel.is-expanded{display:block}nav h2{display:none}}
@media(max-width:760px){.sidebar-navigation{margin-inline:24px}}
</style>
