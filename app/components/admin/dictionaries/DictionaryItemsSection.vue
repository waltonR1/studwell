<!-- 字典展示组件，保存与确认交互由所属 composable 接线。 -->
<script setup lang="ts">
import {adminEnabledStatusOptions} from '~/config/admin/list'
import {Eye, Pencil, Plus, Search, X} from 'lucide-vue-next'
import {formatBeijingTime} from '#shared/utils/beijing-time'
import {useDictionaryItemsManagement} from '~/composables/admin/dictionaries/useDictionaryItemsManagement'
const emit=defineEmits<{saved:[id:string]}>()
const {confirmation,canCreateItem,canUpdateItem,filteredItems,itemPages,pagedItems,writableItem,itemDirty,itemErrors,busy,detail,itemSearch,itemStatus,itemPage,itemPageSize,itemEditorOpen,editingItem,itemError,itemForm,itemTouched,startItem,closeItemEditor,saveItem}=useDictionaryItemsManagement(id=>emit('saved',id))
</script>
<template>
  <template v-if="detail">
    <div class="dictionary-dialog-heading">
      <div><h3>字典选项</h3>
        <p>按排序值、ID 升序展示；任一选项修改都会更新共享版本。</p></div>
      <UButton v-if="canCreateItem" class="admin-button admin-button-primary"
               :disabled="busy || detail.optionCount >= 500" @click="startItem(null)">
        <Plus class="admin-view-button-icon" aria-hidden="true"/>
        新增选项
      </UButton>
    </div>
    <form v-if="itemEditorOpen" id="dictionary-item-inline-form" class="admin-fields dictionary-inline-editor"
          @submit.prevent="saveItem">
      <div class="dictionary-inline-heading dictionary-full-width"><strong>{{
          editingItem ? '编辑选项' : '新增选项'
        }}</strong>
        <UButton type="button" class="admin-button admin-button-quiet" :disabled="busy" aria-label="关闭选项编辑"
                 @click="closeItemEditor">
          <X :size="16" aria-hidden="true"/>
        </UButton>
      </div>
      <label><span>选项编码 <span class="admin-view-required" aria-hidden="true">*</span></span>
        <UInput v-model="itemForm.code" :disabled="busy || !!editingItem || !writableItem" :maxlength="64"
                :ui="{ base: 'admin-input' }" :aria-invalid="!!itemErrors.code" aria-describedby="dictionary-item-code"
                @blur="itemTouched.code = true"/>
        <span id="dictionary-item-code" class="admin-field-error" aria-live="polite">{{
            itemErrors.code || '\u00a0'
          }}</span></label>
      <label><span>显示名称 <span class="admin-view-required" aria-hidden="true">*</span></span>
        <UInput v-model="itemForm.name" :disabled="busy || !writableItem" :maxlength="80" :ui="{ base: 'admin-input' }"
                :aria-invalid="!!itemErrors.name" aria-describedby="dictionary-item-name"
                @blur="itemTouched.name = true"/>
        <span id="dictionary-item-name" class="admin-field-error" aria-live="polite">{{
            itemErrors.name || '\u00a0'
          }}</span></label>
      <label>排序值<input v-model.number="itemForm.sortOrder" class="admin-input" type="number" min="0" max="999999"
                          :disabled="busy || !writableItem" :aria-invalid="!!itemErrors.sortOrder"
                          aria-describedby="dictionary-item-sort" @blur="itemTouched.sortOrder = true"><span
          id="dictionary-item-sort" class="admin-field-error" aria-live="polite">{{
          itemErrors.sortOrder || '\u00a0'
        }}</span></label>
      <div class="dictionary-item-status"><span>{{ itemForm.enabled ? '启用选项' : '停用选项' }}</span>
        <AdminCommonSwitchField v-model="itemForm.enabled" label="启用字典选项" size="medium"
                                :disabled="busy || !writableItem"/>
      </div>
      <p v-if="editingItem" class="dictionary-form-meta dictionary-full-width">选项 ID：{{ editingItem.id }} ·
        创建：{{ formatBeijingTime(editingItem.createdAt) }} · 修改：{{ formatBeijingTime(editingItem.updatedAt) }}</p>
      <AdminCommonFeedback v-if="itemError" class="dictionary-full-width" tone="error">{{
          itemError
        }}
      </AdminCommonFeedback>
      <div class="dictionary-inline-actions dictionary-full-width">
        <UButton type="button" class="admin-button" :disabled="busy" @click="closeItemEditor">取消</UButton>
        <UButton v-if="writableItem" type="submit" class="admin-button admin-button-primary"
                 :disabled="busy || !itemDirty">{{ busy ? '保存中…' : '保存选项' }}
        </UButton>
      </div>
    </form>
    <div v-if="detail.items.length" class="dictionary-option-toolbar">
      <div class="admin-view-search">
        <Search class="admin-view-search-icon" aria-hidden="true"/>
        <UInput v-model="itemSearch" aria-label="搜索选项名称或编码" placeholder="搜索选项名称或编码" :maxlength="100"
                :ui="{ base: 'admin-input' }"/>
      </div>
      <AdminCommonSelectField v-model="itemStatus" label="选项状态筛选"
                              :items="adminEnabledStatusOptions"/>
      <span class="dictionary-filter-summary">显示 {{ filteredItems.length }} 项</span>
    </div>
    <AdminCommonDataState v-if="!detail.items.length" state="empty" title="暂无选项"
                          description="这个字典还没有可维护的部门和岗位选项。"/>
    <AdminCommonDataState v-else-if="!filteredItems.length" state="empty" title="没有匹配的选项"
                          description="请调整关键词或状态筛选。"/>
    <AdminCommonTable v-else :min-width="760" label="字典选项列表">
      <colgroup>
        <col style="width: 36%">
        <col style="width: 14%">
        <col style="width: 14%">
        <col style="width: 20%">
        <col style="width: 16%">
      </colgroup>
      <thead>
      <tr>
        <th>选项</th>
        <th>排序</th>
        <th class="admin-table-status">状态</th>
        <th>更新时间</th>
        <th class="admin-table-actions">操作</th>
      </tr>
      </thead>
      <tbody>
      <tr v-for="item in pagedItems" :key="item.id">
        <td>
          <div><strong class="dictionary-option-name">{{ item.name }}</strong><span
              class="dictionary-option-code">{{ item.code }}</span></div>
        </td>
        <td><span class="dictionary-sort-value">{{ item.sortOrder }}</span></td>
        <td class="admin-table-status">
          <AdminCommonStatusBadge :tone="item.enabled ? 'success' : 'neutral'">{{
              item.enabled ? '启用' : '禁用'
            }}
          </AdminCommonStatusBadge>
        </td>
        <td class="admin-table-time" :title="formatBeijingTime(item.updatedAt)">
          {{ formatBeijingTime(item.updatedAt, 'minute') }}
        </td>
        <td class="admin-table-actions">
          <AdminCommonRowActions>
            <UButton class="admin-button admin-button-quiet" :disabled="busy" @click="startItem(item)">
              {{ canUpdateItem ? '编辑' : '查看' }}
              <Pencil v-if="canUpdateItem" class="admin-view-action-icon" aria-hidden="true"/>
              <Eye v-else class="admin-view-action-icon" aria-hidden="true"/>
            </UButton>
          </AdminCommonRowActions>
        </td>
      </tr>
      </tbody>
    </AdminCommonTable>
    <div v-if="filteredItems.length" class="admin-toolbar admin-pagination dictionary-option-pagination">
      <span>共 {{ filteredItems.length }} 项，第 {{ itemPage }} / {{ itemPages }} 页</span>
      <AdminCommonSelectField v-model="itemPageSize" class="admin-view-page-size" label="选项每页条数"
                              :items="[{ label: '20 条', value: '20' }, { label: '50 条', value: '50' }, { label: '100 条', value: '100' }]"/>
      <UButton class="admin-button" :disabled="itemPage <= 1" @click="itemPage--">上一页</UButton>
      <UButton class="admin-button" :disabled="itemPage >= itemPages" @click="itemPage++">下一页</UButton>
    </div>
    <p class="dictionary-contract-note">停用只影响新选择。历史引用按 ID
      解析当前名称和状态；如需冻结历史名称，应由业务表自行保存快照。</p>
    <AdminCommonConfirmDialog :confirmation="confirmation.state.value" @settle="confirmation.settle"/>
  </template>
</template>
