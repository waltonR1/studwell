<script setup lang="ts">
import {useModuleImageRules} from '~/composables/admin/useModuleImageRules'
const {rules:imageRules,ready:rulesReady,error:rulesError,canRead:canReadRules,retry:retryRules}=useModuleImageRules()
import TextField from '~/components/admin/common/TextField.vue'
import {emptyNewsContent,type NewsContent} from '#shared/schemas/admin/news'
import type {NewsCategory} from '#shared/types/admin/news'
import type {SiteLocale} from '#shared/schemas/admin/site-settings'
import ImageMediaField from '~/components/admin/media/ImageMediaField.vue'
import type {ImageReference} from '#shared/types/image-presentation'
const content=defineModel<NewsContent>({required:true})
// 仅创建当前选中语言的工作草稿，不修改服务端保存基线。
const translation=computed(()=>content.value.localized[props.locale]??(content.value.localized[props.locale]=emptyNewsContent(content.value.categoryId).localized[props.locale]!))
const props=defineProps<{locale:SiteLocale;categories:NewsCategory[];disabled:boolean}>()
function cover(value:ImageReference){content.value.coverMediaId=value.mediaId;content.value.coverPresentation=value.presentation}
function bodyImage(block:Extract<NewsContent['localized'][SiteLocale]['body'][number],{type:'image'}>,value:ImageReference){block.image={mediaId:value.mediaId??'',alt:block.image.alt,presentation:value.presentation}}
function add(type:'paragraph'|'heading'|'image'){translation.value.body.push(type==='image'?{type,image:{mediaId:'',alt:''},caption:''}:{type,text:''})}
function move(index:number,delta:number){const list=translation.value.body;const [item]=list.splice(index,1);if(item)list.splice(index+delta,0,item)}
</script>
<template>
 <div class="news-article-fields">
 <AdminCommonFeedback v-if="rulesError" tone="error">{{ rulesError }}<template #action><UButton class="admin-button" @click="retryRules">重试图片规则</UButton></template></AdminCommonFeedback>
 <p v-else-if="!canReadRules" class="admin-help">当前账号没有媒体读取权限，图片编辑不可用。</p>
 <p v-else-if="!rulesReady" class="admin-help">正在加载图片规则…</p>
 <fieldset class="site-edit-fields news-fields" :disabled="disabled">
  <legend class="sr-only">文章编辑</legend>
  <section class="news-section">
   <h3>标题与摘要</h3>
   <div class="site-fields news-grid">
    <TextField v-model="translation.title" class="site-wide" label="标题" :max="200" :disabled="disabled"/>
    <TextField v-model="translation.summary" class="site-wide" label="摘要" multiline :rows="3" :max="2000" :disabled="disabled"/>
   </div>
  </section>
  <section class="news-section">
   <h3>文章设置</h3>
   <div class="site-fields news-grid">
    <div class="site-field"><span>新闻分类</span><AdminCommonSelectField v-model="content.categoryId" :items="categories.map(c=>({value:c.id,label:c.name[locale]+(c.enabled?'':'（已停用）')}))" label="新闻分类" :disabled="disabled" :body-lock="false"/></div>
    <label class="site-field"><span>展示日期</span><UInput v-model="content.displayDate" type="date" :ui="{base:'admin-input'}"/></label>
    <slot name="settings"/>
    <ImageMediaField :model-value="{mediaId:content.coverMediaId,presentation:content.coverPresentation}" field="news-cover" :image-preset="imageRules?.newsCover" label="文章封面" :disabled="disabled||!rulesReady" @update:model-value="cover"/>
    <div class="news-section">
     <AdminCommonSwitchField v-model="content.featured" label="首页推荐" layout="row" :disabled="disabled"/>
     <label class="site-field"><span>推荐排序（数字小的在前）</span><UInput v-model.number="content.featuredOrder" type="number" :min="0" :max="100000" :ui="{base:'admin-input'}"/></label>
    </div>
   </div>
  </section>
  <section class="news-section">
   <div class="news-section-heading">
    <h3>正文 · 当前语言</h3>
    <AdminCommonRowActions><UButton class="admin-button" @click="add('heading')">添加标题</UButton><UButton class="admin-button" @click="add('paragraph')">添加段落</UButton><UButton class="admin-button" @click="add('image')">添加图片</UButton></AdminCommonRowActions>
   </div>
   <p v-if="!translation.body.length" class="admin-help">当前语言还没有正文，可添加标题、段落或图片。</p>
   <section v-for="(block,index) in translation.body" :key="index" class="news-block">
    <AdminCommonRowActions>
     <strong>{{ index+1 }} · {{ block.type==='heading'?'标题':block.type==='paragraph'?'段落':'图片' }}</strong>
     <UButton class="admin-button" :disabled="disabled||index===0" @click="move(index,-1)">上移</UButton>
     <UButton class="admin-button" :disabled="disabled||index===translation.body.length-1" @click="move(index,1)">下移</UButton>
     <UButton class="admin-button" :disabled="disabled" @click="translation.body.splice(index,1)">删除</UButton>
    </AdminCommonRowActions>
    <template v-if="block.type==='image'">
     <ImageMediaField :model-value="block.image" :field="'news-body-'+index" :image-preset="imageRules?.newsBody" label="正文图片" :disabled="disabled||!rulesReady" @update:model-value="bodyImage(block,$event)"/>
     <TextField v-model="block.image.alt" label="图片替代文字" :max="500" :disabled="disabled"/>
     <TextField v-model="block.caption" label="图注" :max="1000" :disabled="disabled"/>
    </template>
    <TextField v-else v-model="block.text" :label="block.type==='heading'?'正文标题':'正文段落'" multiline :rows="block.type==='heading'?2:5" :max="block.type==='heading'?500:20000" :disabled="disabled"/>
   </section>
  </section>
  <section class="news-section">
   <h3>搜索与来源</h3>
   <div class="site-fields news-grid">
    <TextField v-model="translation.seoTitle" label="SEO 标题" :max="160" :disabled="disabled"/>
    <TextField v-model="translation.seoDescription" label="SEO 描述" multiline :rows="3" :max="500" :disabled="disabled"/>
    <TextField v-model="translation.sourceName" label="来源名称" :max="200" :disabled="disabled"/>
    <TextField v-model="translation.sourceUrl" label="来源网址" :max="2000" :disabled="disabled"/>
   </div>
  </section>
 </fieldset>
 </div>
</template>
<style scoped>
.news-article-fields .news-fields { border: 0; padding: 0; margin: 0; gap: 20px; }
.news-section { display: grid; gap: 12px; min-width: 0; }
.news-fields > .news-section + .news-section {
  border-top: 1px solid var(--admin-view-line);
  padding-top: 20px;
}
.news-section h3 { font-size: 15px; font-weight: 650; }
.news-section-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
.news-grid { gap: 14px 20px; }
.news-grid .site-field { gap: 10px; }
.news-block { display: grid; gap: 12px; padding: 16px; border: 1px solid var(--admin-view-border, #dce4ee); border-radius: 8px; }
</style>
