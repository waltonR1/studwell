<!-- 独立区块编辑展示，保存和离开保护由 useSectionManagement 接线。 -->
<script setup lang="ts">
import ImageMediaField from '~/components/admin/media/ImageMediaField.vue'
import '~/assets/admin/css/components/website-editor.css'
import {companyBrand} from '~/config/admin/brand'
import SectionContentEditor from './SectionContentEditor.vue'
import TemplateBusinessBadges from './TemplateBusinessBadges.vue'
import {templateBusinessModules} from '~/utils/admin/website/template-business'
import SectionEditHeader from './SectionEditHeader.vue'
import PreviewDialog from '~/components/admin/preview/PreviewDialog.vue'
import {useSectionManagement} from '~/composables/admin/website/useSectionManagement'
const {record,draft,section,pending,busy,saving,loadError,saveError,dirty,canEdit,displayTitle,contentError,previewOpen,saveEnabled,id,toast,confirm,save,confirmEntryRemove,locale,pagePath,backTo,backLabel,reload,remainingMedia,updateMedia,templateUpgrade,upgradeTemplate}=useSectionManagement()
useHead(()=>({title:(displayTitle.value||record.value?.name||'网页维护')+' | '+companyBrand.name}))
</script>
<template>
  <section class="admin-module admin-view-page admin-view-detail website-page-module">
    <SectionEditHeader v-model:locale="locale" :back-to="backTo" :back-label="backLabel" :title="displayTitle" description="维护当前区块内容，保存后返回页面管理发布。" :ready="!!record&&!!draft&&!pending&&!loadError" :dirty="dirty" :busy="busy" :saving="saving" :can-edit="canEdit" :save-enabled="saveEnabled" save-label="保存区块草稿" @save="save">
      <template #actions><UButton v-if="templateUpgrade&&canEdit" class="admin-button" :disabled="busy||dirty" @click="upgradeTemplate">升级模板修订 {{ templateUpgrade.revision }}</UButton><UButton v-if="record&&section?.definition&&!pending&&!loadError" class="admin-button" :disabled="busy" title="仅展示当前区块已保存的草稿，不包含未保存修改。" @click="previewOpen=true">预览已保存区块</UButton></template>
    </SectionEditHeader>
    <TemplateBusinessBadges v-if="section&&!pending&&!loadError" :modules="templateBusinessModules(section.businessModules ? section : draft?.templates.find(template=>template.id===section?.templateId))"/>
    <PreviewDialog :open="previewOpen" :src="pagePath+'/preview?mode=draft&locale='+locale+'&sectionId='+encodeURIComponent(id)" :title="displayTitle+' · 区块草稿预览'" description="仅展示当前区块已保存的草稿，包括暂时隐藏的区块；不包含未保存修改。" @close="previewOpen=false" />
    <AdminCommonToast :notification="toast.notification.value" @dismiss="toast.dismiss"/>
    <AdminCommonConfirmDialog :confirmation="confirm.state.value" @settle="confirm.settle"/>
    <AdminCommonDataState v-if="pending" state="loading" title="正在加载区块…"/>
    <AdminCommonDataState v-else-if="loadError" state="error" title="区块加载失败" :description="loadError">
      <template #action>
        <UButton class="admin-button" @click="reload">重试</UButton>
      </template>
    </AdminCommonDataState>
    <template v-else-if="record&&draft">
      <AdminCommonFeedback v-if="saveError" tone="error">{{ saveError }}</AdminCommonFeedback>
      <fieldset class="website-editor" :disabled="busy">
        <template v-if="section&&section.definition">
          <section class="admin-section website-card"><h2>区块资料</h2>
            <label>区块名称<UInput v-model="section.name" :maxlength="100" required :disabled="!canEdit||busy" :ui="{base:'admin-input'}"/></label>
            <p class="admin-help">仅用于后台识别此区块。</p>
          </section>
          <section class="admin-section website-card"><h2>{{ section.name }}</h2>
            <SectionContentEditor :section="section" :locale="locale" :disabled="busy||!canEdit" :readonly="!canEdit"
                                  :confirm-remove="confirmEntryRemove"
                                  @update:localized="section.localized=$event" @update:media="updateMedia" @validation="contentError=$event"/>
          </section>
          <section v-if="remainingMedia.length" class="admin-section website-card"><h2>其他媒体</h2>
            <div v-for="media in remainingMedia" :key="media.key" class="website-media-slot">
              <ImageMediaField v-if="media.kind==='image'" :field="section.id+'-'+media.key" :model-value="media" :label="media.name" :image-preset="media.imagePreset" :disabled="busy||!canEdit" @update:model-value="updateMedia(media.key,$event)"/>
              <AdminMediaPicker v-else :field="section.id+'-'+media.key" :model-value="media.mediaId" :label="media.name" kind="video" :disabled="busy||!canEdit" @update:model-value="updateMedia(media.key,$event)"/>
            </div>
          </section>
        </template>
        <AdminCommonDataState v-else state="empty" title="此区块已移除或模板不可用"/>
      </fieldset>
    </template>
  </section>
</template>
<style scoped>

</style>

