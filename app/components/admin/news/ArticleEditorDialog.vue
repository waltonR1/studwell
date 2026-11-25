<!-- 文章草稿编辑弹窗：直接编辑传入草稿，保存、预览和关闭交给入口。 -->
<script setup lang="ts">
import type {NewsArticle,NewsCategory} from '#shared/types/admin/news'
import type {SiteLocale} from '#shared/schemas/admin/site-settings'
import EditorToolbar from '~/components/admin/website/shared/EditorToolbar.vue'
import TextField from '~/components/admin/common/TextField.vue'
import ArticleFields from './ArticleFields.vue'
defineProps<{categories:NewsCategory[];busy:boolean;dirty:boolean;saveError:string;canEditArticle:boolean}>()
const draft=defineModel<NewsArticle|null>('draft',{required:true})
const locale=defineModel<SiteLocale>('locale',{required:true})
const emit=defineEmits<{close:[];save:[];preview:[]}>()
</script>
<template>
  <div class="news-article-dialog">
   <AdminCommonDialog :open="!!draft" :title="draft?.id?'新闻文章':'新增新闻'" size="large" :busy="busy" @close="emit('close')">
    <div v-if="draft" class="news-editor">
     <EditorToolbar v-model:locale="locale" class="news-toolbar" :dirty="dirty" :disabled="busy"
      :status="draft.status==='published'?'已发布':draft.status==='offline'?'已下线':'未发布'">
      <template #actions>
       <UButton class="admin-button" :disabled="busy" @click="emit('preview')">预览草稿</UButton>
      </template>
     </EditorToolbar>
     <AdminCommonFeedback v-if="saveError" tone="error">{{ saveError }}</AdminCommonFeedback>
     <ArticleFields v-model="draft.content" :locale="locale" :categories="categories" :disabled="busy||!canEditArticle">
      <template #settings>
       <TextField v-model="draft.slug" class="site-wide" label="链接标识" help="用于新闻详情网址，文章发布后不可修改。"
        :disabled="busy||!canEditArticle||!!draft.releases.length" :max="64"/>
      </template>
     </ArticleFields>
    </div>
    <template #actions>
     <UButton class="admin-button" :disabled="busy" @click="emit('close')">关闭</UButton>
     <UButton v-if="canEditArticle" class="admin-button admin-button-primary" :disabled="busy||!dirty" @click="emit('save')">保存草稿</UButton>
    </template>
   </AdminCommonDialog>
  </div>
</template>
<style scoped>
.news-article-dialog :deep(.admin-dialog) { width: min(94vw, 1080px); }
.news-editor { display: grid; gap: 16px; min-width: 0; }
.news-toolbar { margin-bottom: 0; }
</style>
