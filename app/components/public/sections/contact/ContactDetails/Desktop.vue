<!-- 电脑端展示：初始保留拆分前的布局和响应式样式。 -->
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
[id] { scroll-margin-top:calc(var(--header-height) + 20px); }
.contact-details h2 { font-size: var(--text-section); font-weight: var(--font-weight-semibold); line-height: var(--leading-heading); }
.contact-company { margin-top: 20px; font-size: var(--text-lead); font-weight: var(--font-weight-medium); line-height: var(--leading-body); overflow-wrap: anywhere; }
.contact-details-intro { margin-top: 10px; color: var(--color-brand-muted); font-size: var(--text-lead); line-height: var(--leading-body); }
.contact-details dl { margin-top: 28px; }
.contact-channel { display: flex; align-items: start; gap: 18px; padding-block: 18px; border-top: 1px solid var(--rule); }
.contact-channel:last-child { border-bottom: 1px solid var(--rule); }
.contact-channel > svg { flex-shrink: 0; margin-top: 2px; color: var(--color-brand-muted); }
.contact-channel > div { min-width: 0; }
.contact-channel dt { font-size: var(--text-label); color: var(--color-brand-muted); }
.contact-channel dd { margin: 6px 0 0; font-size: var(--text-body); line-height: var(--leading-body); overflow-wrap: anywhere; }
.contact-channel a { display: inline-flex; align-items: center; gap: 12px; text-underline-offset: 4px; }
.contact-channel a svg { flex-shrink: 0; }
.contact-channel a:hover { color: var(--color-brand-red); text-decoration: underline; }
.contact-channel a:focus-visible { outline: 2px solid var(--color-brand-red); outline-offset: 4px; }
.contact-hotlines { display: grid; gap: 10px 24px; margin: 0; padding: 0; list-style: none; }
.contact-hotlines li { display: grid; grid-template-columns: minmax(56px,auto) minmax(0,1fr); align-items: baseline; gap: 8px 20px; }
.contact-hotlines li > span { color: var(--color-brand-muted); font-size: var(--text-small); }
@media (min-width:1280px), (min-width:600px) and (max-width:1023px) { .contact-hotlines { grid-template-columns: repeat(2,minmax(0,1fr)); } .contact-hotlines li { grid-template-columns: 1fr; gap: 2px; } }
@media (max-width:767px) { .contact-channel { padding-block: 18px; gap: 14px; } .contact-channel dd { font-size: var(--text-body); } }
</style>
