<!-- 手机端展示：独立布局与样式。 -->
<script setup lang="ts">
import { Mail, Phone, Printer, MapPin, ArrowUpRight } from 'lucide-vue-next';
import { useContactContactDetails } from '~/composables/public/sections/contact/useContactContactDetails';
const { contentText, details, contactChannels } = useContactContactDetails();
</script>
<template>
  <div id="contact-details" class="contact-details">
    <h2>{{ contentText('title') }}</h2>
    <p class="contact-company">{{ details.companyName }}</p>
    <p class="contact-details-intro">{{ contentText('intro') }}</p>
    <dl>
      <div class="contact-channel"><Mail :size="22" :stroke-width="1.4" aria-hidden="true" /><div><dt>{{ contentText('exportEmail') }}</dt><dd><a :href="`mailto:${contactChannels.exportEmail}`">{{ contactChannels.exportEmail }}<ArrowUpRight :size="16" aria-hidden="true" /></a></dd></div></div>
      <div class="contact-channel"><Mail :size="22" :stroke-width="1.4" aria-hidden="true" /><div><dt>{{ contentText('investmentEmail') }}</dt><dd><a :href="`mailto:${contactChannels.investmentEmail}`">{{ contactChannels.investmentEmail }}<ArrowUpRight :size="16" aria-hidden="true" /></a></dd></div></div>
      <div class="contact-channel"><Phone :size="22" :stroke-width="1.4" aria-hidden="true" /><div>
        <dt>{{ contentText('phone') }}</dt>
        <dd><ul class="contact-hotlines"><li v-for="hotline in contactChannels.hotlines" :key="hotline.language"><span>{{ contentText('languages.' + hotline.language) }}</span><a :href="hotline.href">{{ hotline.number }}</a></li></ul></dd>
      </div></div>
      <div class="contact-channel"><Printer :size="22" :stroke-width="1.4" aria-hidden="true" /><div><dt>{{ contentText('fax') }}</dt><dd>{{ contactChannels.fax }}</dd></div></div>
      <div class="contact-channel"><MapPin :size="22" :stroke-width="1.4" aria-hidden="true" /><div><dt>{{ contentText('address') }}</dt><dd>{{ details.address }}</dd></div></div>
    </dl>
  </div>
</template>
<style scoped>
[id] {
  scroll-margin-top: calc(var(--header-height) + 20px);
}
.contact-channel:last-child {
  border-bottom: 1px solid var(--rule);
}
.contact-channel > div {
  min-width: 0;
}
.contact-channel dt {
  color: var(--color-brand-muted);
  font-size: var(--text-small);
  line-height: var(--leading-compact);
}
.contact-channel dd {
  margin: 6px 0 0;
}
.contact-channel a:hover {
  color: var(--color-brand-red);
  text-decoration: underline;
}
.contact-channel a:focus-visible {
  outline: 2px solid var(--color-brand-red);
  outline-offset: 4px;
}
.contact-hotlines li > span {
  color: var(--color-brand-muted);
  font-size: var(--text-small);
}
.contact-details h2 {
  font-size: var(--text-section);
  font-weight: var(--font-weight-semibold);
  line-height: var(--leading-heading);
  margin: 0;
}
.contact-details h2::before {
  content: '';
  display: block;
  width: 34px;
  height: 4px;
  margin-bottom: 16px;
  background: var(--color-brand-red);
}
.contact-company {
  line-height: var(--leading-body);
  overflow-wrap: anywhere;
  margin: 24px 0 0;
  padding: 18px 16px 10px;
  border-left: 3px solid var(--color-brand-red);
  background: var(--surface-section);
  font-size: var(--text-subtitle);
  font-weight: var(--font-weight-semibold);
}
.contact-details-intro {
  color: var(--color-brand-muted);
  line-height: var(--leading-body);
  margin: 0;
  padding: 0 16px 18px;
  border-left: 3px solid var(--color-brand-red);
  background: var(--surface-section);
  font-size: var(--text-small);
}
.contact-details dl {
  margin: 24px 0 0;
}
.contact-channel {
  display: flex;
  align-items: start;
  border-top: 1px solid var(--rule);
  padding-block: 22px;
  gap: 14px;
}
.contact-channel > svg {
  flex-shrink: 0;
  color: var(--color-brand-red);
  margin-top: 0;
}
.contact-channel dd {
  line-height: var(--leading-body);
  overflow-wrap: anywhere;
  font-size: var(--text-body);
  margin-top: 8px;
}
.contact-channel a {
  display: inline-flex;
  align-items: center;
  text-underline-offset: 4px;
  gap: 8px;
}
.contact-channel a svg {
  flex-shrink: 0;
  color: var(--color-brand-red);
}
.contact-hotlines {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
  gap: 12px;
  grid-template-columns: 1fr;
}
.contact-hotlines li {
  display: grid;
  align-items: baseline;
  grid-template-columns: minmax(0, 1fr);
  gap: 2px;
}
</style>
