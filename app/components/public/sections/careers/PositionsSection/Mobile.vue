<!-- 手机端展示：独立布局与样式。 -->
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
[id] {
  scroll-margin-top: calc(var(--header-height) + 20px);
}
/* 单一列表Section以横线起始，不额外添加编号；空态为正式内容状态而非开发说明。 */
.positions-empty p {
  color: var(--color-brand-muted);
  max-width: 640px;
  margin-top: 14px;
  font-size: var(--text-body);
  line-height: var(--leading-body);
  margin-bottom: 0;
}
.careers-positions {
  border-top: 1px solid var(--rule);
  padding-block: 32px 48px;
}
.positions-heading {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}
.positions-heading h2 {
  font-size: var(--text-section);
  font-weight: var(--font-weight-semibold);
  margin: 0;
  line-height: var(--leading-heading);
}
.positions-heading h2::before {
  content: '';
  display: block;
  width: 34px;
  height: 4px;
  margin-bottom: 16px;
  background: var(--color-brand-red);
}
.positions-heading > span {
  font-size: var(--text-small);
  align-self: end;
  padding: 5px 10px;
  background: var(--surface-section);
  color: var(--color-brand-red);
  line-height: var(--leading-compact);
}
.positions-list {
  display: grid;
  gap: 16px;
}
.positions-list :deep(.position-card) {
  border: 1px solid var(--rule);
  background: var(--surface-section);
}
.positions-list :deep(.position-card summary) {
  padding: 22px 16px;
  gap: 16px;
}
.positions-list :deep(.position-card h3) {
  margin: 0;
  font-weight: var(--font-weight-semibold);
}
.positions-list :deep(.position-card summary p) {
  gap: 6px 10px;
  margin: 10px 0 0;
  line-height: var(--leading-body);
}
.positions-list :deep(.position-card summary > svg) {
  color: var(--color-brand-red);
}
.positions-list :deep(.position-card[open]) {
  border-top: 3px solid var(--color-brand-red);
  background: var(--surface-page);
}
.positions-list :deep(.position-card[open] h3) {
  color: var(--color-brand-red);
}
.positions-list :deep(.position-content) {
  margin-inline: 16px;
  padding-block: 24px;
  border-top: 1px solid var(--rule);
}
.positions-list :deep(.position-content h4) {
  margin: 0;
  padding-left: 12px;
  border-left: 3px solid var(--color-brand-red);
  font-size: var(--text-subtitle);
  line-height: var(--leading-heading);
}
.positions-list :deep(.position-content ul) {
  margin-bottom: 0;
  padding-left: 20px;
}
.positions-list :deep(.position-content li::marker) {
  color: var(--color-brand-red);
}
.positions-list :deep(.position-content > a) {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border: 0;
  background: var(--color-brand-red);
  color: #fff;
  line-height: var(--leading-compact);
}
.positions-empty {
  display: flex;
  align-items: start;
  gap: 16px;
  padding: 24px 18px;
  border: 0;
  border-left: 3px solid var(--color-brand-red);
  background: var(--surface-section);
}
.positions-empty > svg {
  flex-shrink: 0;
  color: var(--color-brand-red);
}
.positions-empty h3 {
  line-height: var(--leading-heading);
  margin: 0;
  font-size: var(--text-card);
}
</style>
