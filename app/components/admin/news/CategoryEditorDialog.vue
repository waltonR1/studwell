<!-- 分类局部草稿编辑弹窗：确认和取消由入口处理，不请求或复制草稿。 -->
<script setup lang="ts">
import type {NewsCategoryInput} from '#shared/schemas/admin/news'
import type {SiteLocale} from '#shared/schemas/admin/site-settings'
import {siteLocaleNames} from '#shared/config/admin/site-settings'
import TextField from '~/components/admin/common/TextField.vue'
defineProps<{locale:SiteLocale;busy:boolean;dirty:boolean;saveError:string;canEditCategory:boolean}>()
const draft=defineModel<(NewsCategoryInput&{id:string|null;version?:number})|null>('draft',{required:true})
const emit=defineEmits<{close:[];confirm:[]}>()
</script>
<template>
  <AdminCommonDialog :open="!!draft" :title="draft?.id?'新闻分类':'新增分类'" :busy="busy" @close="emit('close')">
   <div v-if="draft" class="news-editor">
    <AdminCommonFeedback v-if="saveError" tone="error">{{ saveError }}</AdminCommonFeedback>
    <fieldset class="site-edit-fields news-category-fields" :disabled="busy||!canEditCategory">
     <legend class="sr-only">分类资料</legend>
     <TextField v-model="draft.code" label="分类编码" help="创建后不可修改。" :disabled="busy||!canEditCategory||!!draft.id" :max="64"/>
     <TextField :model-value="draft.name[locale]??''" @update:model-value="draft.name[locale]=$event" :label="'分类名称 · '+siteLocaleNames[locale]" :disabled="busy||!canEditCategory" :max="100"/>
     <p v-if="!draft.id" class="admin-help">确认后可在页面顶部切换语言，再编辑此分类以补齐名称。</p>
     <AdminCommonSwitchField v-model="draft.enabled" label="启用分类" layout="row" :disabled="busy||!canEditCategory"/>
    </fieldset>
   </div>
   <template #actions>
    <UButton class="admin-button" :disabled="busy" @click="emit('close')">{{ canEditCategory?'取消':'关闭' }}</UButton>
    <UButton v-if="canEditCategory" class="admin-button admin-button-primary" :disabled="busy||!dirty" @click="emit('confirm')">确认</UButton>
   </template>
  </AdminCommonDialog>
</template>
<style scoped>
.news-editor { display: grid; gap: 16px; min-width: 0; }
.news-editor .news-category-fields { border: 0; padding: 0; margin: 0; gap: 20px; }
</style>
