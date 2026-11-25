<!-- 场景顺序由 scenes 决定；固定尾部始终接在最后一个场景后。 -->
<script setup lang="ts">
import { usePageScenes } from '~/composables/public/runtime/usePageScenes'
import { hasSceneContent } from '~/utils/public/runtime/pageScenes'

const props = defineProps<{ scenes: { name: string; id?: string }[]; duration?: number; sceneMode?: boolean; headerHeight?:number }>()
const slots = useSlots()
const root = ref<HTMLElement | null>(null)
const { ready, goToScene } = usePageScenes(root, {duration: props.duration, sceneMode: props.sceneMode,headerHeight:props.headerHeight})
// 每次渲染都检查插槽，避免配置仍在但模块被注释后留下空白屏。
const activeScenes = () => props.scenes.filter(scene => {
  const content = slots[scene.name]?.({ goToScene })
  return content && hasSceneContent(content)
}).map((scene, index, scenes) => ({ ...scene, last: index === scenes.length - 1 }))
</script>

<template>
  <div ref="root" class="page-scenes" :class="{ 'is-ready': ready }">
    <div
      v-for="scene in activeScenes()"
      :id="scene.id"
      :key="scene.name"
      :data-page-scene="scene.name"
      data-scene-state="inactive"
      tabindex="-1"
    >
      <slot :name="scene.name" :go-to-scene="goToScene" />
      <slot v-if="scene.last" name="footer" />
    </div>
    <slot v-if="!activeScenes().length" name="footer" />
  </div>
</template>

<style scoped>
/* 脚本测量导航高度后以内联值覆盖，测量前使用导航设计令牌。 */
.page-scenes { --scene-header: var(--header-height); padding-top: var(--header-height); }
.page-scenes > [data-page-scene] { scroll-margin-top: var(--header-height); }
.page-scenes.is-ready { position: fixed; inset: var(--scene-header) 0 0; padding-top: 0; overflow: hidden; background: var(--color-brand-paper); isolation: isolate; }
/* 分区仅在滚动条侧预留槽位，避免页脚左侧出现空白。 */
.is-ready > [data-page-scene] { position: absolute; inset: 0; overflow-y: auto; overflow-x: clip; scrollbar-gutter: stable; overscroll-behavior: contain; background: #fff; outline: none; }
.is-ready > [data-page-scene] > :deep(section) { min-height: 100%; }
/* 使用标准分区间距的区块居中；内容超长时由 safe center 回退到顶部。 */
.is-ready > [data-page-scene] > :deep(.section-space) {
  display: flex;
  flex-direction: column;
  justify-content: center;
  justify-content: safe center;
}
@media (min-width: 768px) {
  .is-ready > [data-page-scene] > :deep(.section-space) { padding-block: clamp(24px, 4dvh, 40px); }
}
</style>

