<!-- 电脑端展示：初始保留拆分前的布局和响应式样式。 -->
<script setup lang="ts">
import PositionCard from '~/components/public/sections/careers/PositionCard.vue';
import { BriefcaseBusiness } from 'lucide-vue-next';
import { useCareersPositionsSection } from '~/composables/public/sections/careers/useCareersPositionsSection';
const viewSetup = useCareersPositionsSection();
const viewResolved = await viewSetup.pending;
const { contentText, positions, available, error, pending, statusText } = viewSetup.resume(viewResolved);
</script>
<template>
  <section id="careers-positions" class="careers-shell careers-positions" aria-labelledby="careers-positions-title">
    <div class="positions-heading">
      <h2 id="careers-positions-title">{{ contentText('title') }}</h2>
      <span v-if="!pending && !error && available">{{ contentText('count', { count: positions.length }) }}</span>
    </div>
    <p v-if="pending" role="status">{{ statusText[0] }}</p>
    <p v-else-if="error || !available" role="status">{{ statusText[1] }}</p>
    <div v-else-if="positions.length" class="positions-list">
      <PositionCard v-for="position in positions" :key="position.id" :position="position" />
    </div>
    <div v-else class="positions-empty">
      <BriefcaseBusiness :size="32" :stroke-width="1.3" aria-hidden="true" />
      <div><h3>{{ contentText('emptyTitle') }}</h3><p>{{ contentText('emptyIntro') }}</p></div>
    </div>
  </section>
</template>
<style scoped>
[id] { scroll-margin-top:calc(var(--header-height) + 20px); }
/* 单一列表Section以横线起始，不额外添加编号；空态为正式内容状态而非开发说明。 */
.careers-positions { padding-block: 32px 40px; border-top: 1px solid var(--rule); }
.positions-heading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 28px; }
.positions-heading h2 { font-size: var(--text-section); font-weight: var(--font-weight-semibold); }
.positions-heading > span { color: var(--color-brand-muted); font-size: var(--text-small); }
.positions-empty { display: flex; align-items: start; gap: 24px; padding: clamp(28px,4vw,48px); border: 1px solid var(--rule); }
.positions-empty > svg { flex-shrink: 0; color: var(--color-brand-muted); }
.positions-empty h3 { font-size: var(--text-card); line-height: var(--leading-heading); }
.positions-empty p { max-width: 640px; margin-top: 14px; color: var(--color-brand-muted); font-size: var(--text-body); line-height: var(--leading-body); }
@media (max-width:767px) { .careers-positions { padding-block: 24px 32px; } .positions-heading { margin-bottom: 24px; } .positions-empty { gap: 18px; padding: 24px; } .positions-empty h3 { font-size: var(--text-card); } }
</style>
