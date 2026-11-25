<script setup lang="ts">
import {usePublishedSection} from '~/composables/public/runtime/usePublicPage'
interface Node{id:string;title:string;count:number;enabled:boolean;children?:Node[]}
const {t:copy,data}=usePublishedSection<{tree:Node}>()
const nodes=computed(()=>{const result:Array<Node&{depth:number}>=[];function visit(node:Node,depth:number){result.push({...node,depth});for(const child of node.children??[])visit(child,depth+1)}if(data.value.tree)visit(data.value.tree,0);return result})
</script>
<template>
 <section class="guide-structure guide-article-frame">
  <h2>{{ copy('title') }}</h2><p>{{ copy('intro') }}</p>
  <ol><li v-for="node in nodes" :key="node.id" :style="{marginInlineStart:node.depth*22+'px'}" :class="{muted:!node.enabled}">
   <div><code>{{ node.id }}</code><h3>{{ node.title }}</h3></div><span>{{ node.count }} · {{ node.enabled?copy('enabled'):copy('disabled') }}</span>
  </li></ol>
 </section>
</template>
<style scoped>
.guide-structure{padding-block:35px;scroll-margin-top:120px}.guide-structure h2{font-size:28px;line-height:1.4;margin:0 0 12px}.guide-structure>p{color:#64748b;line-height:1.9}.guide-structure ol{list-style:none;padding:0;max-width:860px;margin:26px 0}.guide-structure li{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-block:10px;padding:18px 22px;border:1px solid #dce6f2;border-radius:10px;background:#f5f8fd}.guide-structure code{font-size:12px;color:#6682a7}.guide-structure h3{font-size:17px;margin:5px 0 0}.guide-structure li>span{font-size:13px;color:#57759d}.guide-structure li.muted{opacity:.58}@media(max-width:600px){.guide-structure li{padding:14px;gap:10px}.guide-structure li>span{max-width:95px}}
</style>
