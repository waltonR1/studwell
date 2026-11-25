<!-- 搜索表单：输入与校验提示，提交行为通过事件交给搜索区域协调。 -->
<script setup lang="ts">
import { Search, ArrowRight, X } from 'lucide-vue-next'
const props = defineProps<{ submittedQuery: string; error: string | null }>()
const draft = defineModel<string>({ required: true })
const emit = defineEmits<{ submit: []; clear: [] }>()
const { t } = useI18n()
const input = ref<HTMLInputElement>()
function reset() { emit('clear'); input.value?.focus() }
onMounted(() => { if (!props.submittedQuery && window.matchMedia('(min-width: 1024px) and (pointer: fine)').matches) input.value?.focus({ preventScroll: true }) })
</script>
<template>
  <form class="search-form" role="search" @submit.prevent="emit('submit')">
    <label class="search-sr-only" for="site-query">{{ t('search.label') }}</label>
    <Search :size="24" aria-hidden="true" class="input-icon" />
    <input id="site-query" ref="input" v-model="draft" type="search" :placeholder="t('search.placeholder')" :aria-invalid="!!error" :aria-describedby="error ? 'query-error' : undefined" enterkeyhint="search" autocomplete="off">
    <button v-if="draft || submittedQuery" type="button" class="clear-query" :aria-label="t('search.clear')" @click="reset"><X :size="20" aria-hidden="true" /></button>
    <button type="submit" class="search-submit">{{ t('search.submit') }}<ArrowRight :size="18" aria-hidden="true" /></button>
  </form>
  <p v-if="error" id="query-error" class="query-error" role="alert">{{ t(`search.${error}`) }}</p>

</template>
<style scoped>
.search-form { display: flex; align-items: center; gap: 16px; padding: 10px 10px 10px 24px; border: 1px solid #18283240; background: white; }
.search-form:focus-within { border-color: var(--color-brand-red); box-shadow: 0 0 0 1px var(--color-brand-red); }
.input-icon { flex-shrink: 0; color: var(--color-brand-muted); }
.search-form input { flex: 1; width: 0; min-width: 0; min-height: 44px; background: transparent; border: 0; font-size: var(--text-lead); outline: none; }
.search-form input::-webkit-search-cancel-button { display: none; }
.search-submit { display: flex; justify-content: center; align-items: center; gap: 16px; min-height: 50px; padding: 12px 24px; color: white; background: var(--color-brand-red); flex-shrink: 0; }
.clear-query { display: grid; place-items: center; width: 44px; height: 44px; flex-shrink: 0; }
.query-error { margin-top: 12px; color: var(--color-brand-red); }
@media (hover: hover) { .search-submit:hover { background: var(--action-hover); } }
@media (max-width: 600px) {
  .search-form { gap: 8px; padding: 8px; }
  .input-icon { display: none; }
  .search-form input { font-size: var(--text-body); padding-left: 6px; }
  .search-submit { padding-inline: 14px; gap: 8px; }
  .search-submit svg { display: none; }
}
</style>
