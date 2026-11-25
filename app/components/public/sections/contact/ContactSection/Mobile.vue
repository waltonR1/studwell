<!-- 手机端展示：独立布局与样式。 -->
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
.contact-content > * {
  min-width: 0;
}
.contact-content {
  display: grid;
  align-items: start;
  border-top: 1px solid var(--rule);
  grid-template-columns: 1fr;
  padding-block: 32px 48px;
  gap: 40px;
}
</style>
