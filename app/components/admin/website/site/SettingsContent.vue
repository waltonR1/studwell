<script setup lang="ts">
import {useModuleImageRules} from '~/composables/admin/useModuleImageRules'
import {storeToRefs} from 'pinia'
import {useAdminSiteSettingsStore} from '~/stores/admin/site-settings'
import type {SiteLocale,SiteSection,SiteLink} from '#shared/schemas/admin/site-settings'
import type {SiteContentActions} from '~/types/admin/website-maintenance'
import {formatBeijingTime} from '#shared/utils/beijing-time'
import {siteTargetLabel} from '~/utils/admin/site-settings/labels'
import ImageMediaField from '~/components/admin/media/ImageMediaField.vue'
import type {ImageReference} from '#shared/types/image-presentation'
import NavigationTree from './NavigationTree.vue'
const props=defineProps<{page:SiteSection;locale:SiteLocale;actions:SiteContentActions}>()
const {rules:imageRules,ready:rulesReady,error:rulesError,canRead:canReadRules,retry:retryRules}=useModuleImageRules(()=>props.page==='basic')
const store=useAdminSiteSettingsStore()
const {record,draft,busy,canEdit}=storeToRefs(store)
const active=computed(()=>props.page)
const targets=computed(()=>record.value?.targets??[])
const targetName=(link:SiteLink)=>siteTargetLabel(link,targets.value,props.locale)
const editLink=store.editLink,editGroup=store.editGroup,move=store.moveNavigation
const {closeEditor,confirmLink,remove}=props.actions
function image(field:'logo'|'favicon',value:ImageReference){if(!canEdit.value||busy.value)return;if(field==='logo'){draft.value.basic.logoId=value.mediaId;draft.value.basic.logoPresentation=value.presentation}else{draft.value.basic.faviconId=value.mediaId;draft.value.basic.faviconPresentation=value.presentation}}
</script>
<template>
 <template v-if="record">

        <template v-if="active==='basic'">
          <section class="admin-section site-card"><h3>网站标识</h3>
              <AdminCommonFeedback v-if="rulesError" tone="error">{{ rulesError }}<template #action><UButton class="admin-button" @click="retryRules">重试</UButton></template></AdminCommonFeedback>
              <p v-else-if="!canReadRules" class="admin-help">当前账号没有媒体读取权限，图片编辑不可用。</p>
              <p v-else-if="!rulesReady" class="admin-help">正在加载图片规则…</p>
              <div class="site-media-fields">
                <ImageMediaField field="logoId" :model-value="{mediaId:draft.basic.logoId,presentation:draft.basic.logoPresentation}" :image-preset="imageRules?.logo" label="网站 Logo" :disabled="!canEdit || busy || !rulesReady" @update:model-value="image('logo',$event)"/>
                <ImageMediaField field="faviconId" :model-value="{mediaId:draft.basic.faviconId,presentation:draft.basic.faviconPresentation}" :image-preset="imageRules?.favicon" label="浏览器图标" :disabled="!canEdit || busy || !rulesReady" @update:model-value="image('favicon',$event)"/>
              </div>
            </section>
        </template>
        <template v-if="active==='header'">
          <section class="admin-section site-card"><label class="site-field">展开菜单介绍文字
              <UInput :disabled="!canEdit" v-model="draft.header.tagline[locale]" aria-describedby="header-tagline-help"
                      :maxlength="200" :ui="{base: 'admin-input'}"/>
            </label>
              <p id="header-tagline-help" class="site-help">用于展开菜单后的介绍区域，仅在屏幕宽度为 768–1439
                像素时显示；手机和桌面常规导航不显示。官网目前仍使用语言文件中的文字，尚未接入此配置。</p></section>
        </template>
        <AdminWebsiteSiteFooterForm v-if="active==='footer'" :locale="locale"/>
        <NavigationTree v-if="active==='header'||active==='footer'" :section="active" :header="draft.header" :footer="draft.footer" :locale="locale"
                            :disabled="!canEdit||busy" :busy="busy" :target-name="targetName" @edit="editLink" @group="editGroup" @move="move" @remove="remove" @visibility="store.setNavigationVisible"/>

      <p v-if="record.updatedAt" class="site-help">最近保存：{{ formatBeijingTime(record.updatedAt) }}</p>

 </template>
 <AdminWebsiteSiteNavigationDialog :locale="locale" @close="closeEditor" @confirm="confirmLink"/>
</template>
