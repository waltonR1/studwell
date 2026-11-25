<!-- 电脑端展示：初始保留拆分前的布局和响应式样式。 -->
<script setup lang="ts">
import ContactDetails from '~/components/public/sections/contact/ContactDetails.vue';
import InquiryForm from '~/components/public/sections/contact/InquiryForm.vue';
export type ViewProps = {
  id?: string;
};
defineProps<ViewProps>();
</script>
<template>
  <section class="contact-shell contact-content" :aria-label="$t('nav.contact')">
    <ContactDetails :id="id ?? 'contact-details'" />
    <InquiryForm />
  </section>
</template>
<style scoped>
.contact-content { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1.15fr); align-items: start; gap: clamp(40px,6vw,96px); padding-block: 48px 88px; border-top: 1px solid var(--rule); }
.contact-content > * { min-width: 0; }
@media (max-width:1023px) { .contact-content { grid-template-columns: 1fr; gap: 36px; } }
@media (max-width:767px) { .contact-content { padding-block: 28px 48px; gap: 28px; } }
</style>
