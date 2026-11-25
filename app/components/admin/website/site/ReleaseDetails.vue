<script setup lang="ts">
import {adminContentLocale} from '#shared/config/site-languages'
import {siteFooterFields} from '~/config/admin/site-settings'
import {siteTargetLabel} from '~/utils/admin/site-settings/labels'
import {storeToRefs} from 'pinia'
import {useAdminSiteSettingsStore} from '~/stores/admin/site-settings'
import {useAdminSessionStore} from '~/stores/admin/session'
import {siteLocaleNames} from '#shared/config/admin/site-settings'
import type {SiteLocale, SiteLink, SiteSection} from '#shared/schemas/admin/site-settings'
import type {SiteTarget} from '#shared/types/admin/site-settings'
import {formatBeijingTime} from '#shared/utils/beijing-time'
import {adminMediaFileUrl} from '~/api/admin/media'

const props = defineProps<{ releaseId: string; section: SiteSection; targets: SiteTarget[] }>()
defineEmits<{ back: [] }>()
const store = useAdminSiteSettingsStore(), session = useAdminSessionStore()
const {releaseDetail: detail, detailPending: pending, detailError: error} = storeToRefs(store)
const locale = ref<SiteLocale>(adminContentLocale)
const load = () => store.loadDetail(props.section, props.releaseId)
onMounted(load)
onBeforeUnmount(() => store.closeDetail(props.releaseId))
const targetName = (link: SiteLink) => siteTargetLabel(link, props.targets, locale.value)
const headerRows = computed(() => detail.value?.content.header?.items.flatMap(item => [{
  item,
  level: '一级导航',
  parent: '—',
}, ...item.children.map(child => ({
  item: child,
  level: '二级导航',
  parent: item.label[locale.value] || targetName(item),
}))]) ?? [])
const footerRows = computed(() => detail.value?.content.footer?.groups.flatMap(group => [{
  id: group.id,
  label: group.title[locale.value],
  parent: '—',
  target: '链接分组',
  visible: group.visible
}, ...group.items.map(item => ({
  id: group.id + ':' + item.id,
  label: item.label[locale.value] || targetName(item),
  parent: group.title[locale.value],
  target: targetName(item),
  visible: item.visible
}))]) ?? [])
const footerFields = siteFooterFields
</script>
<template>
  <div class="site-release-details">
    <div class="site-settings-toolbar">
      <UButton class="admin-button" @click="$emit('back')">返回发布记录</UButton>
      <AdminCommonSelectField v-if="section !== 'basic'" v-model="locale"
                              :items="Object.entries(siteLocaleNames).map(([value,label])=>({value,label}))"
                              label="历史内容语言" :body-lock="false"/>
    </div>
    <AdminCommonDataState v-if="pending" state="loading" title="正在读取历史内容…"/>
    <AdminCommonDataState v-else-if="error" state="error" title="历史内容读取失败" :description="error">
      <template #action>
        <UButton class="admin-button" @click="load">重试</UButton>
      </template>
    </AdminCommonDataState>
    <template v-else-if="detail">
      <p class="site-help">以下为该次发布的只读内容，查看不会修改当前草稿。</p>
      <dl class="site-release-fields">
        <div>
          <dt>发布时间</dt>
          <dd>{{ formatBeijingTime(detail.createdAt) }}</dd>
        </div>
        <div>
          <dt>发布人</dt>
          <dd><AdminWebsiteSharedPublicationAuthor :author="detail" /></dd>
        </div>
        <div>
          <dt>状态</dt>
          <dd>{{ detail.isCurrent ? '当前发布版本' : '历史版本' }}</dd>
        </div>
        <div>
          <dt>发布编号</dt>
          <dd>{{ detail.id }}</dd>
        </div>
        <div v-if="detail.restoredFrom">
          <dt>回滚来源</dt>
          <dd>{{ detail.restoredFrom }}</dd>
        </div>
      </dl>
      <template v-if="detail.content.basic"><h3>网站标识</h3>
        <div class="site-media-fields">
          <div v-for="(label,field) in {logoId:'网站 Logo',faviconId:'浏览器图标'}" :key="field"><strong>{{
              label
            }}</strong>
            <div class="site-media-current"><img v-if="detail.content.basic[field] && session.can('content.media.read')"
                                                 :src="adminMediaFileUrl(detail.content.basic[field]!)"
                                                 :alt="label"><span
                v-else>{{ detail.content.basic[field] ? '无媒体查看权限' : '未设置' }}</span></div>
            <p v-if="detail.content.basic[field]" class="site-help">媒体编号：{{ detail.content.basic[field] }}</p></div>
        </div>
      </template>
      <template v-if="detail.content.header"><h3>页头内容</h3>
        <p class="site-release-text">展开菜单介绍文字：{{ detail.content.header.tagline[locale] || '未填写' }}</p>
        <AdminCommonTable label="历史页头导航" :min-width="700">
          <thead>
          <tr>
            <th>名称</th>
            <th>层级</th>
            <th>上级</th>
            <th>跳转位置</th>
            <th>显示状态</th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="row in headerRows" :key="row.parent+':'+row.item.id">
            <td>{{ row.item.label[locale] || targetName(row.item) }}</td>
            <td>{{ row.level }}</td>
            <td>{{ row.parent }}</td>
            <td>{{ targetName(row.item) }}</td>
            <td>{{ row.item.visible ? '显示' : '隐藏' }}</td>
          </tr>
          </tbody>
        </AdminCommonTable>
      </template>
      <template v-if="detail.content.footer"><h3>页脚内容</h3>
        <dl class="site-release-fields">
          <div v-for="[field,label] in footerFields" :key="field">
            <dt>{{ label }}</dt>
            <dd>{{ detail.content.footer[field][locale] || '未填写' }}</dd>
          </div>
        </dl>
        <dl class="site-release-fields"><div v-for="contact in detail.content.footer.contacts" :key="contact.id"><dt>{{ contact.label[locale] }}（{{ contact.visible?'显示':'隐藏' }}）</dt><dd>{{ contact.value[locale]||'未填写' }}</dd></div></dl>
        <AdminCommonTable label="历史页脚链接" :min-width="600">
          <thead>
          <tr>
            <th>名称</th>
            <th>所属分组</th>
            <th>跳转位置</th>
            <th>显示状态</th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="row in footerRows" :key="row.id">
            <td>{{ row.label || '未填写' }}</td>
            <td>{{ row.parent }}</td>
            <td>{{ row.target }}</td>
            <td>{{ row.visible ? '显示' : '隐藏' }}</td>
          </tr>
          </tbody>
        </AdminCommonTable>
      </template>
    </template>
  </div>
</template>
<style scoped>
.site-release-details h3 {
  font-size: 16px;
  font-weight: 600;
  margin-block: 28px 16px;
}

.site-release-fields {
  display: grid;
  gap: 16px;
  margin-block: 16px;
}

.site-release-fields > div {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  gap: 16px;
}

.site-release-fields dt {
  color: var(--admin-view-muted);
}

.site-release-fields dd, .site-release-text {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
