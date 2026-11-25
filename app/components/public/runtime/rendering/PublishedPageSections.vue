<!-- 按页面配置选择普通列表或场景模式渲染已发布区块。 -->
<script setup lang="ts">
import type {PublicPageStructure, PublicSection} from '#shared/types/public/website'
import PublishedSectionList from './PublishedSectionList.vue'
import PageScenes from './PageScenes.vue'
import PublishedSection from './PublishedSection.vue'
import {resolvePageScenes} from '~/utils/public/runtime/pageScenes'
import {resolveSectionRenderer} from '~/utils/public/runtime/sectionRenderer'

const props=defineProps<{structure: PublicPageStructure; sections: PublicSection[];headerHeight?:number;observeScenes?:boolean}>()
const scenes=computed(()=>resolvePageScenes(props.sections,section=>resolveSectionRenderer(section.renderer)))
const structureKey=computed(()=>JSON.stringify([props.structure.sceneEnabled,props.structure.sceneTransitionSeconds,scenes.value.map(({name,templateKey,id})=>[name,templateKey,id])]))
</script>

<template>
  <PageScenes v-if="structure.sceneEnabled||observeScenes" :key="structureKey" :scenes="scenes" :duration="structure.sceneTransitionSeconds??undefined" :header-height="headerHeight" :scene-mode="structure.sceneEnabled">
    <template v-for="(scene,index) in scenes" :key="scene.name" #[scene.name]="{goToScene}">
      <PublishedSection :id="scene.name"><component :is="scene.component" @next="scenes[index+1]&&goToScene(scenes[index+1]!.name)" /></PublishedSection>
    </template>
    <template v-if="$slots.footer" #footer><slot name="footer" /></template>
  </PageScenes>
  <template v-else>
    <PublishedSectionList :sections="sections" />
    <slot name="footer" />
  </template>
</template>
