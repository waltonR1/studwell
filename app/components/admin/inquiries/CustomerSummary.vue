<!-- 咨询客户资料和原始留言，只消费详情数据，不读取 store 或执行操作。 -->
<script setup lang="ts">
import type {InquiryDetailResponse} from '#shared/types/admin/inquiry-responses'
import {formatBeijingTime} from '#shared/utils/beijing-time'
import {siteLocaleNames} from '#shared/config/admin/site-settings'
import {statuses,statusTones} from '~/config/admin/inquiry-list'
import {emailLink} from '~/utils/admin/inquiries/email-link'
defineProps<{inquiry:InquiryDetailResponse['inquiry']}>()
</script>
<template>
        <header class="inquiry-summary">
          <div class="inquiry-summary-main">
            <h3>{{ inquiry.name }}</h3>
            <AdminCommonStatusBadge :tone="statusTones[inquiry.status]">{{ statuses[inquiry.status] }}</AdminCommonStatusBadge>
          </div>
          <div class="inquiry-meta">
            <span>{{ inquiry.categoryLabel }}</span>
            <time :datetime="inquiry.createdAt">{{ formatBeijingTime(inquiry.createdAt) }}</time>
            <span>编号 {{ inquiry.id }}</span>
          </div>
        </header>

        <section class="inquiry-section" aria-label="客户留言">
          <h3>客户留言</h3>
          <p class="inquiry-body inquiry-message">{{ inquiry.message }}</p>
        </section>

        <section class="inquiry-section" aria-label="客户资料">
          <h3>客户资料</h3>
          <dl class="inquiry-fields">
            <div><dt>邮箱</dt><dd><a class="inquiry-email" :href="emailLink(inquiry.email, inquiry.id)">{{ inquiry.email }}</a></dd></div>
            <div><dt>公司</dt><dd>{{ inquiry.company || '未填写' }}</dd></div>
            <div><dt>国家或地区</dt><dd>{{ inquiry.country || '未填写' }}</dd></div>
            <div><dt>提交语言</dt><dd>{{ siteLocaleNames[inquiry.locale] }}</dd></div>
          </dl>
        </section>

</template>
<style scoped src="~/assets/admin/css/components/inquiry-detail.css"></style>
