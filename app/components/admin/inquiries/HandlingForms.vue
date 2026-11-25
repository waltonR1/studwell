<!-- 咨询处理、跟进与回复表单，输入连接原草稿，提交事件交给入口。 -->
<script setup lang="ts">
import type {InquiryDetailResponse} from '#shared/types/admin/inquiry-responses'
defineProps<{detail:InquiryDetailResponse;writable:boolean;canAssign:boolean;canClaim:boolean;canReply:boolean;busy:boolean;detailStale:boolean;changed:boolean;detailStatusOptions:{value:string;label:string;disabled?:boolean}[];assigneeOptions:{value:string;label:string}[];submitErrors:Partial<Record<string,string>>}>()
const nextStatus=defineModel<string>('nextStatus',{required:true}),assignee=defineModel<string>('assignee',{required:true}),note=defineModel<string>('note',{required:true}),repliedExternally=defineModel<boolean>('repliedExternally',{required:true}),reply=defineModel<string>('reply',{required:true})
const emit=defineEmits<{assignment:[claim:boolean];saveNote:[];sendReply:[]}>()
</script>
<template>
        <section class="inquiry-section inquiry-divider" aria-label="处理与分派">
          <h3>处理与分派</h3>
          <div v-if="writable || canAssign" class="inquiry-controls">
            <div v-if="writable" class="inquiry-control">
              <span>处理状态</span>
              <AdminCommonSelectField v-model="nextStatus" label="处理状态" :items="detailStatusOptions" :disabled="busy"/>
            </div>
            <div v-if="canAssign" class="inquiry-control">
              <span>负责人</span>
              <AdminCommonSelectField v-model="assignee" label="负责人" :items="assigneeOptions" :disabled="busy"/>
            </div>
            <div class="inquiry-actions">
              <UButton v-if="canClaim" class="admin-button" :disabled="busy || detailStale" @click="emit('assignment',true)">认领给我</UButton>
              <UButton class="admin-button" :disabled="busy || detailStale || !changed" @click="emit('assignment',false)">保存处理信息</UButton>
            </div>
          </div>
          <AdminCommonFeedback v-if="submitErrors.assignment" tone="error">{{ submitErrors.assignment }}</AdminCommonFeedback>
          <p v-if="!canAssign">负责人：{{ detail.inquiry.assigneeName || '未分派' }}</p>
          <p v-if="writable && !detail.inquiry.canWaitForCustomer" class="admin-help">回复邮件被服务器接收，或登记外部回复后，可切换为「等待客户」。</p>
        </section>

        <section v-if="writable" class="inquiry-section inquiry-divider" aria-label="添加跟进">
          <h3>添加跟进</h3>
          <form class="admin-fields admin-view-create-form" @submit.prevent="emit('saveNote')">
            <AdminCommonTextField v-model="note" class="admin-view-full-width" label="跟进内容" multiline :rows="3" :max="1000" :disabled="busy"/>
            <div class="admin-view-status-row admin-view-full-width">
              <div>
                <strong class="admin-view-status-title">已通过工作邮箱回复客户</strong>
                <p class="admin-view-status-description">开启后，保存跟进时会登记为本轮已回复，可切换到「等待客户」。此操作不会发送邮件。</p>
              </div>
              <AdminCommonSwitchField v-model="repliedExternally" label="已通过工作邮箱回复客户" size="medium" :disabled="busy"/>
            </div>
            <AdminCommonFeedback v-if="submitErrors.note" class="admin-view-full-width" tone="error">{{ submitErrors.note }}</AdminCommonFeedback>
            <div class="admin-view-panel-actions">
              <UButton class="admin-button admin-button-primary" type="submit" :disabled="busy || detailStale || !note.trim()">记录跟进</UButton>
            </div>
          </form>
        </section>

        <section v-if="canReply" class="inquiry-section inquiry-divider" aria-label="邮件回复">
          <h3>邮件回复</h3>
          <form class="admin-fields admin-view-create-form" @submit.prevent="emit('sendReply')">
            <AdminCommonTextField v-model="reply" class="admin-view-full-width" label="回复客户" multiline :rows="4" :max="3000" :disabled="busy"
              :help="'发送至 ' + detail.inquiry.email + '。客户回信将进入 ' + detail.replyAddress + '。'"/>
            <AdminCommonFeedback v-if="submitErrors.reply" class="admin-view-full-width" tone="error">{{ submitErrors.reply }}</AdminCommonFeedback>
            <div class="admin-view-panel-actions">
              <UButton type="submit" class="admin-button admin-button-primary" :disabled="busy || detailStale || !reply.trim()">发送邮件回复</UButton>
            </div>
          </form>
        </section>

</template>
<style scoped src="~/assets/admin/css/components/inquiry-detail.css"></style>
