<!-- 跟进与投递时间线展示，异常关闭和重试通过事件回到业务入口。 -->
<script setup lang="ts">
import type {InquiryDetailResponse} from '#shared/types/admin/inquiry-responses'
import {formatBeijingTime} from '#shared/utils/beijing-time'
import {statuses,actionNames,mailStatuses,mailLabels} from '~/config/admin/inquiry-list'
const props=defineProps<{detail:InquiryDetailResponse;awaitingDelivery:boolean;canSend:boolean;busy:boolean;detailStale:boolean;closingDelivery:string;closeError?:string}>()
const closeReason=defineModel<string>('closeReason',{required:true})
const emit=defineEmits<{closeIssue:[];cancelClose:[];retry:[id:string];beginClose:[id:string]}>()
const timeline=computed(()=>[
 ...props.detail.history.map(event=>({type:'event' as const,event,id:event.id,at:event.createdAt})),
 ...props.detail.mail.map(delivery=>({type:'mail' as const,delivery,id:delivery.id,at:delivery.sentAt??delivery.createdAt})),
].sort((a,b)=>b.at.localeCompare(a.at)||b.id.localeCompare(a.id)))
</script>
<template>
        <section class="inquiry-section inquiry-divider" aria-label="跟进时间线">
          <div class="inquiry-history-heading">
            <h3>跟进时间线 <span class="inquiry-muted">{{ detail.history.length === 100 || detail.mail.length === 100 ? '最近记录' : timeline.length + ' 条' }}</span></h3>
            <span v-if="awaitingDelivery" class="inquiry-muted">投递状态自动更新</span>
          </div>
          <p v-if="!timeline.length" class="inquiry-empty">暂无跟进记录。</p>
          <ol v-else class="inquiry-history">
            <li v-for="entry in timeline" :key="entry.id">
              <template v-if="entry.type === 'event'">
                <div class="inquiry-history-heading">
                  <strong>{{ actionNames[entry.event.action] }}</strong>
                  <time :datetime="entry.at">{{ formatBeijingTime(entry.at) }}</time>
                </div>
                <p class="inquiry-muted">操作人：{{ entry.event.actorName }}</p>
                <p v-if="entry.event.action === 'update'">
                  <span v-if="entry.event.status">{{ statuses[entry.event.status] }} · </span>负责人：{{ entry.event.assigneeName || '未分派' }}
                </p>
                <p v-if="entry.event.note" class="inquiry-body">{{ entry.event.note }}</p>
              </template>
              <template v-else>
                <div class="inquiry-history-heading">
                  <strong>{{ mailLabels[entry.delivery.kind] }}</strong>
                  <AdminCommonStatusBadge :tone="entry.delivery.status === 'sent' ? 'success' : entry.delivery.status === 'failed' ? 'danger' : 'neutral'">
                    {{ mailStatuses[entry.delivery.status] }}
                  </AdminCommonStatusBadge>
                </div>
                <p class="inquiry-muted">{{ entry.delivery.recipient }} · {{ formatBeijingTime(entry.delivery.sentAt ?? entry.delivery.createdAt) }}</p>
                <p v-if="entry.delivery.body" class="inquiry-body">{{ entry.delivery.body }}</p>
                <template v-if="entry.delivery.resolution">
                  <p class="inquiry-muted">异常已关闭 · {{ entry.delivery.resolution.actorName }} · {{ formatBeijingTime(entry.delivery.resolution.at) }}</p>
                  <p class="inquiry-body">原因：{{ entry.delivery.resolution.reason }}</p>
                </template>
                <template v-else-if="entry.delivery.status === 'uncertain' || entry.delivery.status === 'failed'">
                  <p v-if="entry.delivery.status === 'uncertain'" class="admin-help">请先核对邮箱，避免重复发送。</p>
                  <form v-if="canSend && closingDelivery === entry.delivery.id" class="inquiry-section" @submit.prevent="emit('closeIssue')">
                    <AdminCommonTextField v-model="closeReason" label="关闭原因" :max="300" :disabled="busy"
                      help="例如：测试记录无需补发，或已通过其他方式联系客户。"/>
                    <AdminCommonFeedback v-if="closeError" tone="error">{{ closeError }}</AdminCommonFeedback>
                    <div class="inquiry-actions">
                      <UButton type="submit" class="admin-button admin-button-primary" :disabled="busy || detailStale || !closeReason.trim()">确认关闭</UButton>
                      <UButton type="button" class="admin-button" :disabled="busy" @click="emit('cancelClose')">取消</UButton>
                    </div>
                  </form>
                  <div v-else-if="canSend" class="inquiry-actions">
                    <UButton v-if="entry.delivery.status === 'failed' && detail.inquiry.status !== 'spam' && detail.mailKinds.includes(entry.delivery.kind)"
                      class="admin-button" :disabled="busy || detailStale" @click="emit('retry',entry.delivery.id)">重试投递</UButton>
                    <UButton class="admin-button" :disabled="busy" @click="emit('beginClose',entry.delivery.id)">关闭投递异常</UButton>
                  </div>
                </template>
              </template>
            </li>
          </ol>
        </section></template>
<style scoped src="~/assets/admin/css/components/inquiry-detail.css"></style>
