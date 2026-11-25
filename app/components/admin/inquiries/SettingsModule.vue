<!-- 咨询设置表单装配；请求、草稿与交互编排归 store 和专属 composable。 -->
<script setup lang="ts">
import ModuleNotice from '~/components/admin/business/ModuleNotice.vue'
import EditorToolbar from '~/components/admin/website/shared/EditorToolbar.vue'
import type {InquirySettings} from '#shared/schemas/admin/inquiry-settings'
import {siteLocaleNames} from '#shared/config/admin/site-settings'
import {forwardBodyTokens,forwardSubjectTokens,forwardTemplateTokens} from '#shared/config/admin/inquiry-forward-template'
import {mailFields,mailSwitches,forwardRoutes,forwardContents,templateOptions,replyRoutes} from '~/config/admin/inquiry-settings'
import {useInquirySettingsManagement} from '~/composables/admin/inquiries/useInquirySettingsManagement'
const props=defineProps<{mode:'categories'|'mail'}>()
const {isCategories,title,locale,draft,pending,loadError,error,selected,editing,dirty,editorError,codeLocked,forwardMode,editingTemplate,load,addCategory,editCategory,applyCategory,setEnabled,move,busy,confirmation,toast,categorySearch,categoryStatus,appliedCategorySearch,appliedCategoryStatus,categoryRows,displayedCategoryRows,preview,tokenText,assigneeOptions,queryCategories,save,closeEditor,remove,restoreForwardTemplate}=useInquirySettingsManagement(props)
</script>
<template>
  <section class="admin-module admin-view-page admin-view-list">
    <AdminCommonPageHeader :title="title" :description="isCategories ? '维护官网咨询类型、团队邮箱和默认负责人。' : '管理咨询通知、转发文案和客户回信去向。'">
      <template v-if="draft && !loadError" #actions>
        <EditorToolbar class="inquiry-settings-toolbar" :locale="isCategories ? locale : undefined" :dirty="dirty"
          :disabled="busy || pending" @update:locale="locale = $event">
          <template #actions>
            <UButton class="admin-button admin-button-primary" :disabled="busy || pending || !dirty || !!editing" @click="save">{{ busy ? '正在保存…' : '保存' }}</UButton>
          </template>
        </EditorToolbar>
      </template>
    </AdminCommonPageHeader>
    <ModuleNotice module="inquiries"/>
    <AdminCommonDataState v-if="pending" state="loading" title="正在加载咨询设置…"/>
    <AdminCommonDataState v-else-if="loadError" state="error" title="咨询设置加载失败" :description="loadError">
      <template #action><UButton class="admin-button" @click="load">重试</UButton></template>
    </AdminCommonDataState>
    <template v-else-if="draft">
      <AdminCommonFeedback v-if="error" tone="error">{{ error }}</AdminCommonFeedback>
      <AdminCommonTreeListEditor v-if="isCategories" v-model:search="categorySearch" v-model:visibility="categoryStatus"
        title="咨询类型" description="官网只显示启用的类型，顺序与此处一致。"
        :count="displayedCategoryRows.length" :rows="displayedCategoryRows" label="咨询类型" :name-label="siteLocaleNames[locale] + '名称'"
        create-label="新增类型" placeholder="搜索咨询类型名称或代码" empty-title="暂无匹配的咨询类型"
        empty-description="请调整查询条件，或新增咨询类型。" note="被历史咨询引用的类型只能停用。排序、显隐和编辑会在保存设置后生效。"
        paginated :min-width="750" :writable="true" :can-create="categoryRows.length < 50" :can-delete="true" :busy="busy"
        :filtered="!!appliedCategorySearch || !!appliedCategoryStatus"
        :status-labels="{column:'官网状态',filter:'筛选官网状态',visible:'启用',hidden:'停用'}"
        :can-move="(row, direction) => direction === 'up' ? row.index > 0 : row.index < categoryRows.length - 1"
        @query="queryCategories" @create="addCategory"
        @move="(row, direction) => move(row.index, direction === 'up' ? -1 : 1)"
        @visibility="(row, visible) => setEnabled(row.index, visible)"
        @edit="row => editCategory(row.index)" @remove="row => remove(row.index)">
        <template #head><th>类型代码</th></template>
        <template #cells="{row}"><td>{{ row.code || '—' }}</td></template>
      </AdminCommonTreeListEditor>

      <section v-else class="admin-section admin-view-panel" aria-label="邮件设置">
        <h2>邮件功能</h2>
        <p class="admin-view-section-description">三种邮件可分别启用。关闭后，对应邮件暂停投递；咨询仍会进入后台。</p>
        <AdminCommonFeedback v-if="!draft.transportConfigured" tone="info">尚未配置服务器发信服务。可以先保存地址，配置发信服务后再启用邮件功能。</AdminCommonFeedback>
        <form class="admin-fields admin-view-profile-form" @submit.prevent="save">
          <div v-for="item in mailSwitches" :key="item.key" class="admin-view-status-row admin-view-full-width">
            <div>
              <strong class="admin-view-status-title">{{ item.label }}</strong>
              <p class="admin-view-status-description">{{ item.help }}</p>
            </div>
            <AdminCommonSwitchField v-model="draft.settings.mail[item.key]" :label="item.label" size="medium"
              :disabled="busy || (!draft.transportConfigured && !draft.settings.mail[item.key])"/>
          </div>
          <section class="admin-view-full-width inquiry-settings-group" aria-labelledby="inquiry-mail-routing">
            <h3 id="inquiry-mail-routing" class="admin-view-status-title">通知与回信规则</h3>
            <div class="admin-fields admin-view-profile-form">
              <div class="inquiry-settings-control">
                <p class="admin-view-field-label">新咨询通知去向</p>
                <AdminCommonSelectField :model-value="draft.settings.mail.forwardRoute" label="新咨询通知去向" :items="forwardRoutes" :disabled="busy"
                  @update:model-value="draft.settings.mail.forwardRoute = $event as InquirySettings['mail']['forwardRoute']"/>
              </div>
              <div class="inquiry-settings-control">
                <p class="admin-view-field-label">通知邮件内容</p>
                <AdminCommonSelectField :model-value="draft.settings.mail.forwardContent" label="通知邮件内容" :items="forwardContents" :disabled="busy"
                  @update:model-value="draft.settings.mail.forwardContent = $event as InquirySettings['mail']['forwardContent']"/>
              </div>
              <div class="admin-view-full-width inquiry-settings-control">
                <p class="admin-view-field-label">客户回信去向</p>
                <AdminCommonSelectField :model-value="draft.settings.mail.replyRoute" label="客户回信去向" :items="replyRoutes" :disabled="busy"
                  @update:model-value="draft.settings.mail.replyRoute = $event as InquirySettings['mail']['replyRoute']"/>
                <p class="admin-help">负责人邮箱不可用时，依次使用类型团队邮箱和统一回信邮箱。</p>
              </div>
            </div>
          </section>
          <section v-if="editingTemplate" class="admin-view-full-width inquiry-settings-group" aria-labelledby="inquiry-forward-template">
            <div class="admin-toolbar">
              <h3 id="inquiry-forward-template" class="admin-view-status-title">转发邮件文案</h3>
              <AdminCommonSelectField :model-value="forwardMode" label="选择要编辑的邮件模板" :items="templateOptions" :disabled="busy"
                @update:model-value="forwardMode = $event as 'notice' | 'details'"/>
              <AdminCommonStatusBadge v-if="forwardMode === draft.settings.mail.forwardContent" tone="success">当前选用</AdminCommonStatusBadge>
              <UButton type="button" class="admin-button" :disabled="busy" @click="restoreForwardTemplate">恢复默认文案</UButton>
            </div>
            <p class="admin-help">两种通知各有自己的文案。切换编辑模板不会改变通知规则；保存后只影响新进入队列的邮件。</p>
            <div class="admin-fields admin-view-profile-form">
              <AdminCommonTextField v-model="editingTemplate.subject" class="admin-view-full-width" label="邮件主题" :max="150"
                :disabled="busy" :help="'主题支持：' + forwardSubjectTokens.map(tokenText).join('、')"/>
              <AdminCommonTextField v-model="editingTemplate.body" class="admin-view-full-width" label="邮件正文（纯文本）" multiline
                :rows="9" :max="6000" :disabled="busy"/>
              <div class="admin-view-full-width inquiry-token-list">
                <span v-for="key in forwardBodyTokens[forwardMode]" :key="key" class="admin-help">
                  <code>{{ tokenText(key) }}</code> {{ forwardTemplateTokens[key].label }}
                </span>
              </div>
              <details v-if="preview" class="admin-view-full-width inquiry-template-preview">
                <summary class="admin-view-status-title">预览示例邮件</summary>
                <p>主题：{{ preview.subject }}</p>
                <p>{{ preview.body }}</p>
              </details>
            </div>
          </section>
          <section class="admin-view-full-width inquiry-settings-group" aria-labelledby="inquiry-mail-addresses">
            <h3 id="inquiry-mail-addresses" class="admin-view-status-title">邮箱地址</h3>
            <div class="admin-fields admin-view-profile-form">
              <AdminCommonTextField v-for="field in mailFields" :key="field.key" v-model="draft.settings.mail[field.key]"
                :label="field.label" :max="254" :disabled="busy"/>
            </div>
          </section>
        </form>
      </section>
    </template>

    <AdminCommonDialog v-if="isCategories" :open="!!editing" :title="selected < 0 ? '新增咨询类型' : '编辑咨询类型'"
      description="确认后，可在页面顶部切换语言或保存修改。" @close="closeEditor">
      <form v-if="editing" id="inquiry-category-form" class="admin-fields admin-view-create-form" @submit.prevent="applyCategory(locale)">
        <AdminCommonTextField v-model="editing.code" label="类型代码" :max="16" :disabled="codeLocked"
          help="最多 16 个字符，小写字母开头，可用数字、短横线和下划线。保存后不可更改。"/>
        <AdminCommonTextField :model-value="editing.labels[locale]??''" @update:model-value="editing.labels[locale]=$event" :label="siteLocaleNames[locale] + '名称'" :max="80"/>
        <AdminCommonTextField v-model="editing.forwardTo" label="类型团队邮箱（选填）" :max="254" help="用于按类型通知，也可接收客户回信。"/>
        <div>
          <p class="admin-view-field-label">默认负责人</p>
          <AdminCommonSelectField v-model="editing.defaultAssigneeId" label="默认负责人" :items="assigneeOptions" :body-lock="false"/>
          <p class="admin-help">仅影响新咨询。未选择或负责人失效时，由团队手动认领。</p>
        </div>
        <div class="admin-view-status-row admin-view-full-width">
          <div><strong class="admin-view-status-title">在官网启用</strong><p class="admin-view-status-description">停用后仍可查看历史咨询。</p></div>
          <AdminCommonSwitchField v-model="editing.enabled" label="在官网启用" size="medium"/>
        </div>
        <AdminCommonFeedback v-if="editorError" class="admin-view-full-width" tone="error">{{ editorError }}</AdminCommonFeedback>
      </form>
      <template #actions>
        <UButton class="admin-button" @click="closeEditor">取消</UButton>
        <UButton type="submit" form="inquiry-category-form" class="admin-button admin-button-primary">确认</UButton>
      </template>
    </AdminCommonDialog>
    <AdminCommonConfirmDialog :confirmation="confirmation.state.value" @settle="confirmation.settle"/>
    <AdminCommonToast :notification="toast.notification.value" @dismiss="toast.dismiss"/>
  </section>
</template>

<style scoped>
.inquiry-settings-toolbar {
  margin-bottom: 0;
}

.inquiry-settings-group {
  display: grid;
  gap: 18px;
  margin-top: 10px;
  padding-top: 22px;
  border-top: 1px solid var(--admin-view-line);
}

.inquiry-settings-group > .admin-fields {
  padding-top: 0;
}

.inquiry-settings-control {
  display: grid;
  align-content: start;
  gap: 8px;
  min-width: 0;
}

.inquiry-settings-control > .admin-help {
  margin: 0;
}

.inquiry-token-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.inquiry-template-preview {
  padding: 16px;
  border: 1px solid var(--admin-view-line);
  border-radius: 8px;
}

.inquiry-template-preview summary {
  cursor: pointer;
}

.inquiry-template-preview p {
  margin: 12px 0 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
