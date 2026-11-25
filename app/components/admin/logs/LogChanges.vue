<script setup lang="ts">
import type {LogChangeContext} from '#shared/types/admin/log-changes'
import {logChangeFields, logChangeModes} from '#shared/config/admin/log-changes'
import {logChangeValueText, logChangeSetDifference} from '#shared/utils/admin/log-changes'

const props = defineProps<{context: LogChangeContext}>()
const rows = computed(() => props.context.fields.map(item => ({...item, difference: logChangeSetDifference(item.before, item.after)})))
</script>

<template>
  <section class="log-detail-section" :aria-label="logChangeModes[context.mode]">
    <h3>{{ logChangeModes[context.mode] }}</h3>
    <p v-if="!rows.length" class="log-meta">无业务字段变化。</p>
    <div v-else class="log-changes-scroll">
      <table class="log-changes-table">
        <thead><tr><th>字段</th><th v-if="context.mode !== 'create'">修改前</th><th v-if="context.mode !== 'delete'">{{ context.mode === 'create' ? '新增值' : '修改后' }}</th></tr></thead>
        <tbody>
          <tr v-for="row in rows" :key="row.field">
            <th scope="row">{{ logChangeFields[row.field] }}</th>
            <td v-if="context.mode !== 'create'">{{ logChangeValueText(row.before) }}</td>
            <td v-if="context.mode !== 'delete'">
              {{ logChangeValueText(row.after) }}
              <template v-if="row.difference && context.mode === 'update'">
                <p v-if="row.difference.added.length" class="log-change-added">新增：{{ logChangeValueText(row.difference.added) }}</p>
                <p v-if="row.difference.removed.length" class="log-change-removed">移除：{{ logChangeValueText(row.difference.removed) }}</p>
              </template>
              <p v-if="(row.field === 'email' || row.field === 'phone' || row.field === 'remark') && context.mode === 'update'" class="log-meta">已变更，内容已脱敏。</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
