<script setup lang="ts">
import {describeMenu} from '~/utils/admin/menus/tree'
import type {RolePermission} from '#shared/types/admin/roles'
import type {RoleMenuOption} from '#shared/types/admin/menus'
import {storeToRefs} from 'pinia'
import {useAdminRolesStore} from '~/stores/admin/roles'
import {useAdminSessionStore} from '~/stores/admin/session'
import {useAdminActionConfirm} from '~/composables/admin/interaction/useAdminActionConfirm'

const store = useAdminRolesStore(), auth = useAdminSessionStore(), confirmation = useAdminActionConfirm()
const {
  editor,
  authorizationOptions,
  authorizationInScope,
  authorizationReady,
  canMenus,
  canPermissions,
  requiredPermissions,
  missingPermissions,
  menuDirty,
  permissionsDirty,
  authorizationDirty,
  removing,
  permissionGroups
} = storeToRefs(store)
const permissions = computed({
  get: () => editor.value.selected,
  set: value => { editor.value.selected = value }
})
const data = computed(() => editor.value.menus)
const options = authorizationOptions
const inScope = authorizationInScope
const ready = authorizationReady
const required = requiredPermissions
const missing = missingPermissions
const dirty = authorizationDirty
const groups = permissionGroups
const submitError = computed(() => editor.value.submitError)
const warning = computed(() => editor.value.warning)
const loadError = computed(() => editor.value.menusError)
const pending = computed(() => editor.value.menusPending)
const busy = computed(() => editor.value.busy)
const menuIds = computed({
  get: () => editor.value.menuIds,
  set: value => { editor.value.menuIds = value }
})

async function refresh() {
  await store.refreshAuthorization()
}

async function toggleMenu(item: RoleMenuOption, event: Event) {
  const input = event.target as HTMLInputElement, checked = input.checked
  input.checked = menuIds.value.includes(item.id)
  const result = store.prepareMenuToggle(item, checked)
  if (!result.needsConfirmation)
    return
  if (!await confirmation.ask({
    title: '取消页面授权',
    message: '取消“' + item.name + '”及其对应操作权限？其他仍选中的页面所需权限会保留。本次修改将在保存后生效。',
    confirmLabel: '取消页面授权'
  })) {
    store.cancelMenuRemoval()
    return
  }
  store.commitMenuRemoval()
}

function toggleDashboard(event: Event) {
  const input = event.target as HTMLInputElement, checked = input.checked
  input.checked = permissions.value.includes('system.dashboard.read')
  store.toggleDashboard(checked)
}

function batch(items: RolePermission[], event: Event) {
  store.toggleBatch(items, (event.target as HTMLInputElement).checked)
}

const batchState = store.batchState
const selectionBlocked = store.selectionBlocked

async function save() {
  await store.saveAuthorization()
}
</script>
<template>
  <section class="admin-section admin-view-panel role-authorization">
    <header class="authorization-heading">
      <div><h2>页面与操作授权</h2>
        <p>先选择页面，再设置可执行的操作，最后统一保存。</p></div>
      <AdminCommonDraftBadge :dirty="dirty"/>
    </header>
    <AdminCommonFeedback v-if="submitError" tone="error">{{ submitError }}</AdminCommonFeedback>
    <AdminCommonFeedback v-if="warning" tone="warning">{{ warning }}</AdminCommonFeedback>
    <AdminCommonFeedback v-if="loadError" title="菜单目录加载失败">{{ loadError }}
      <template #action>
        <UButton class="admin-button" :disabled="busy" @click="refresh()">重试</UButton>
      </template>
    </AdminCommonFeedback>
    <AdminCommonDataState v-if="pending && !data" state="loading" title="正在加载页面菜单…"/>
    <p v-if="!inScope" class="admin-help">当前角色包含超出你菜单授权范围的关联，页面菜单仅可查看。</p>
    <h3>选择页面菜单</h3>
    <p class="admin-help">勾选页面后配置可用操作；取消页面会同时撤销对应权限，其他已选页面所需权限保留。</p>
    <div class="authorization-menu-list">
      <div class="authorization-menu-row"><label class="authorization-menu-choice"><input type="checkbox"
                                                                                          :checked="permissions.includes('system.dashboard.read')"
                                                                                          :disabled="!canPermissions || !store.visibleCatalog.some(item => item.code === 'system.dashboard.read' && item.grantable && item.available)"
                                                                                          @change="toggleDashboard($event)"><span>后台首页</span></label><span
          class="authorization-menu-tags"><small>查看首页统计</small></span></div>
      <div v-for="item in options" :key="item.id" class="authorization-menu-row"
           :style="{ paddingInlineStart: (14 + describeMenu(item, options).depth * 18) + 'px' }"><label
          v-if="item.pageKey || menuIds.includes(item.id)" class="authorization-menu-choice"><input type="checkbox"
                                                                                                    :checked="menuIds.includes(item.id)"
                                                                                                    :disabled="!canMenus || !!removing || !!selectionBlocked(item) || (!item.grantable && !(auth.isRoot && menuIds.includes(item.id)))"
                                                                                                    @change="toggleMenu(item, $event)"><span>{{
          item.name
        }}</span></label><strong v-else>{{ item.name }}</strong><span class="authorization-menu-tags"><small
          v-if="selectionBlocked(item)">{{ selectionBlocked(item) }}</small><small
          v-if="!item.pageKey">目录 / 自动补齐</small><small v-if="!item.visible">已隐藏</small><small
          v-else-if="describeMenu(item, options).hiddenByParent">上级已隐藏</small><small
          v-if="item.pageKey && !item.grantable">不可新增授权</small></span></div>
    </div>
    <p v-if="missing.length" class="admin-help">当前页面授权不完整，请联系有权分配该页面的管理员处理。</p>
    <section v-for="group in groups" :key="group.key" class="authorization-group">
      <div class="role-operation-heading"><h3>{{ group.names.join('、') }}</h3><label
          v-if="auth.can('system.roles.assign_permissions')" class="role-operation-batch"><input type="checkbox"
                                                                                                :checked="batchState(group.items).checked"
                                                                                                :indeterminate="batchState(group.items).indeterminate"
                                                                                                :disabled="!canPermissions || !batchState(group.items).eligible.length"
                                                                                                @change="batch(group.items, $event)">全选可选操作</label>
      </div>
      <p v-if="group.names.length > 1" class="admin-help">这些入口共用同一组操作权限。</p>
      <div class="authorization-permissions"><label v-for="item in group.items" :key="item.code"
                                                    class="authorization-option"
                                                    :class="{ 'is-selected': permissions.includes(item.code) }"><input
          v-model="permissions" type="checkbox" :value="item.code"
          :disabled="!canPermissions || required.includes(item.code) || (!item.grantable && !permissions.includes(item.code))"><span><strong>{{
          item.name
        }}</strong><small v-if="!item.available">已停用，仅可移除</small><small
          v-else-if="!item.grantable">超出可授予范围</small></span></label></div>
    </section>

    <div v-if="auth.can('system.roles.assign_permissions') || auth.can('system.roles.assign_menus')"
         class="authorization-actions">
      <UButton class="admin-button admin-button-primary"
               :disabled="!ready || !dirty || !!missing.length || (menuDirty && !canMenus) || (permissionsDirty && !canPermissions)"
               @click="save">{{ busy ? '保存中…' : '保存页面与操作授权' }}
      </UButton>
    </div>
    <AdminCommonConfirmDialog :confirmation="confirmation.state.value" @settle="confirmation.settle"/>
  </section>
</template>
<style scoped>
.role-operation-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.role-operation-batch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #526b84;
  font-size: 13px;
}

.role-authorization > h3 {
  margin: 20px 0 10px;
}

.role-authorization :deep(.admin-view-panel) {
  margin-top: 24px;
  box-shadow: none;
}
</style>
