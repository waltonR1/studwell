<!-- 电脑端展示：初始保留拆分前的布局和响应式样式。 -->
<script setup lang="ts">
import { ArrowUpRight, CheckCircle2, ChevronDown } from 'lucide-vue-next';
import { useInquiryForm } from '~/composables/public/sections/contact/useInquiryForm';
const { fields, categories, categoryStatus, invalidEmail, pending, reference, error, submit } = await useInquiryForm();
const categoryId = useId();
const emailId = useId();
function flagMissingCategory(event: Event) {
  event.preventDefault();
  categoryRequired.value = true;
  document.getElementById(categoryId)?.focus();
}
async function submitForm() {
  await submit();
  if (invalidEmail.value) {
    await nextTick();
    document.getElementById(emailId)?.focus();
  }
}
const categoryRequired = ref(false);
</script>
<template>
  <form class="inquiry-form" aria-labelledby="contact-form-title" aria-describedby="contact-form-note" @submit.prevent="submitForm">
    <header class="inquiry-header">
      <h2 id="contact-form-title">{{ $t('contact.formSection.title') }}</h2>
      <p id="contact-form-note" class="inquiry-note">{{ $t('contact.formSection.note') }}</p>
    </header>

    <fieldset :disabled="pending">
      <div class="inquiry-fields">
        <div class="inquiry-wide inquiry-category" @invalid.capture="flagMissingCategory">
          <label :for="categoryId">{{ $t('contact.formSection.category') }} <span class="inquiry-required" aria-hidden="true">*</span></label>
          <div class="inquiry-select-control">
            <USelect :id="categoryId" v-model="fields.category" name="category" required value-key="code" :items="categories"
              :disabled="pending || !categories.length" :placeholder="$t('contact.formSection.chooseCategory')"
              :aria-invalid="categoryRequired || undefined" :aria-describedby="categoryRequired ? categoryId + '-error' : undefined"
              :portal="false" :content="{position: 'popper', align: 'start', sideOffset: 4, collisionPadding: 8, bodyLock: false}"
              :ui="{base: 'inquiry-select-trigger', content: 'inquiry-select-menu'}"
              @update:model-value="categoryRequired = false">
              <template #trailing><ChevronDown :size="18" aria-hidden="true" /></template>
            </USelect>
          </div>
          <p v-if="categoryRequired" :id="categoryId + '-error'" class="inquiry-required" role="alert">{{ $t('contact.formSection.chooseCategory') }}</p>
        </div>
        <label>
          <span>{{ $t('contact.formSection.name') }} <span class="inquiry-required" aria-hidden="true">*</span></span>
          <input v-model.trim="fields.name" name="name" autocomplete="name" maxlength="100" required />
        </label>
        <label>
          <span>{{ $t('contact.formSection.email') }} <span class="inquiry-required" aria-hidden="true">*</span></span>
          <input :id="emailId" v-model.trim="fields.email" name="email" type="email" autocomplete="email" maxlength="254" required
            :aria-invalid="invalidEmail || undefined" :aria-describedby="invalidEmail ? emailId + '-error' : undefined" @input="invalidEmail = false" />
          <span v-if="invalidEmail" :id="emailId + '-error'" class="inquiry-required" role="alert">{{ $t('contact.formSection.invalidEmail') }}</span>
        </label>
        <label>
          <span>{{ $t('contact.formSection.company') }} <small>{{ $t('contact.formSection.optional') }}</small></span>
          <input v-model.trim="fields.company" name="company" autocomplete="organization" maxlength="120" />
        </label>
        <label>
          <span>{{ $t('contact.formSection.country') }} <small>{{ $t('contact.formSection.optional') }}</small></span>
          <input v-model.trim="fields.country" name="country" autocomplete="country-name" maxlength="100" />
        </label>
        <label class="inquiry-wide">
          <span>{{ $t('contact.formSection.message') }} <span class="inquiry-required" aria-hidden="true">*</span></span>
          <textarea v-model.trim="fields.message" name="message" rows="4" maxlength="3000" required />
        </label>
      </div>
      <footer class="inquiry-footer">
        <button class="button button-red inquiry-submit" type="submit" :disabled="pending || !categories.length">
          {{ $t(pending ? 'contact.formSection.submitting' : 'contact.formSection.submit') }}
          <ArrowUpRight :size="18" aria-hidden="true" />
        </button>
      </footer>
    </fieldset>
    <p v-if="reference" class="inquiry-feedback inquiry-success" role="status">
      <CheckCircle2 :size="18" aria-hidden="true" />
      <span>{{ $t('contact.formSection.received', {id: reference}) }}</span>
    </p>
    <p v-if="error || categoryStatus === 'error'" class="inquiry-feedback inquiry-error" role="alert">
      {{ error === 'rateLimited' ? $t('contact.formSection.rateLimited') : error === 'categoryChanged' ? $t('contact.formSection.categoryChanged') : $t('contact.formSection.failed') }}
    </p>
  </form>
</template>
<style scoped>
#contact-form-title { scroll-margin-top: calc(var(--header-height) + 20px); }
.inquiry-form {
  padding: clamp(24px, 3vw, 44px);
  border: 1px solid var(--rule);
  border-radius: 12px;
  background: var(--surface-section);
  color: var(--color-brand-text);
}
.inquiry-form fieldset { margin: 0; padding: 0; border: 0; min-width: 0; }
.inquiry-header::before { content: ''; display: block; width: 32px; height: 3px; margin-bottom: 14px; background: var(--color-brand-red); }
.inquiry-header h2 { font-size: clamp(24px, 2.1vw, 36px); font-weight: var(--font-weight-semibold); line-height: var(--leading-heading); }
.inquiry-note { margin-top: 10px; color: var(--color-brand-muted); font-size: var(--text-small); line-height: var(--leading-body); }
.inquiry-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 20px; margin-top: 26px; }
.inquiry-fields:has(input[aria-invalid='true']) { align-items: start; }
.inquiry-wide { grid-column: 1 / -1; }
.inquiry-form label { display: grid; grid-template-rows: 1fr auto; gap: 7px; min-width: 0; font-size: var(--text-small); font-weight: var(--font-weight-medium); }
.inquiry-form small { margin-inline-start: 5px; color: var(--color-brand-muted); font-size: .85em; font-weight: 400; }
.inquiry-required { color: var(--color-brand-red); }
.inquiry-form :is(input, textarea), .inquiry-category :deep(.inquiry-select-trigger) {
  display: block; width: 100%; min-width: 0; min-height: 46px; padding: 10px 12px;
  border: 1px solid var(--color-brand-gray); border-radius: 6px; background: var(--surface-page);
  color: var(--color-brand-text); font: inherit; font-size: max(16px, var(--text-small)); font-weight: 400;
}
.inquiry-form :is(input, textarea):focus-visible, .inquiry-category :deep(.inquiry-select-trigger:focus-visible), .inquiry-submit:focus-visible {
  outline: 2px solid var(--color-brand-red); outline-offset: 2px;
}
.inquiry-form :is(input, textarea):disabled { opacity: .7; cursor: wait; }
.inquiry-form textarea { min-height: 116px; resize: vertical; }
.inquiry-category { display: grid; gap: 7px; min-width: 0; }
.inquiry-select-control { min-width: 0; }
.inquiry-category label { display: block; }
.inquiry-category :deep(.inquiry-select-trigger) { display: flex; justify-content: space-between; text-align: start; }
.inquiry-category :deep(.inquiry-select-trigger [data-slot='value']),
.inquiry-category :deep(.inquiry-select-trigger [data-slot='placeholder']) { min-width: 0; overflow-wrap: anywhere; }
.inquiry-category :deep(.inquiry-select-trigger [data-slot='trailing']) { flex: none; margin-inline-start: 8px; }
.inquiry-category :deep(.inquiry-select-menu) {
  width: var(--reka-select-trigger-width);
  max-width: var(--reka-select-content-available-width, calc(100vw - 16px));
  max-height: min(15rem, var(--reka-select-content-available-height, 15rem));
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 4px;
  border: 1px solid var(--color-brand-gray);
  border-radius: 6px;
  background: var(--surface-page);
  color: var(--color-brand-text);
  box-shadow: 0 6px 20px #18283220;
  z-index: 40;
}
.inquiry-category :deep(.inquiry-select-menu [data-slot='item']) {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  min-height: 44px; padding: 8px 10px; border-radius: 4px; overflow-wrap: anywhere; cursor: pointer;
}
.inquiry-category :deep(.inquiry-select-menu [data-highlighted]) { background: var(--surface-panel); outline: none; }
.inquiry-category :deep(.inquiry-select-menu [data-slot='itemTrailingIcon']) { display: block; width: 16px; height: 16px; color: var(--color-brand-red); }
.inquiry-footer { display: flex; margin-top: 22px; }
.inquiry-submit { gap: 14px; min-height: 48px; padding: 12px 18px; border-radius: 6px; cursor: pointer; }
.inquiry-submit:disabled { opacity: .65; cursor: wait; }
.inquiry-feedback { margin-top: 16px; padding: 10px 12px; border-radius: 6px; font-size: var(--text-small); overflow-wrap: anywhere; }
.inquiry-success { display: flex; align-items: start; gap: 8px; background: #eaf4ed; color: #245138; }
.inquiry-success svg { flex: none; }
.inquiry-error { background: #f9e9eb; color: #831b25; }
@media (max-width: 600px) {
  .inquiry-form { padding: 22px 18px; }
  .inquiry-fields { grid-template-columns: 1fr; gap: 14px; margin-top: 20px; }
  .inquiry-submit { width: 100%; }
}
</style>
