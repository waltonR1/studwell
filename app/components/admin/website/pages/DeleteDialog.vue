<script setup lang="ts">
import {storeToRefs} from 'pinia'
import {useAdminWebsitePagesStore} from '~/stores/admin/website-pages'

const store=useAdminWebsitePagesStore()
const {record,busy,deletionError}=storeToRefs(store)
const props=defineProps<{open:boolean}>()
const emit=defineEmits<{close:[];confirm:[code:string]}>()
const deleteCode=ref('')
watch(()=>props.open,()=>{deleteCode.value=''})
</script>
<template>
<AdminCommonDialog :open="open" title="永久删除页面" size="medium" :busy="busy"
                     @close="emit('close')">
    <template v-if="record">
      <p>将永久删除“{{ record.name }}”的页面设置、{{ record.sections.length }}
        个区块、{{ record.publication.releases.length }} 条发布历史及对应后台菜单，无法撤销。</p>
      <p>该菜单的角色授权和页面媒体引用将一并清理；媒体原文件、可复用模板和审计日志保留。</p>
      <label class="site-field">输入页面编码 <strong>{{ record.key }}</strong> 确认
        <UInput v-model="deleteCode" :disabled="busy" autocomplete="off" :placeholder="record.key"
                :ui="{base:'admin-input'}"/>
      </label>
      <AdminCommonFeedback v-if="deletionError" tone="error">{{ deletionError }}</AdminCommonFeedback>
    </template>
    <template #actions>
      <UButton class="admin-button" :disabled="busy" @click="emit('close')">取消</UButton>
      <UButton class="admin-button admin-button-danger" data-tone="danger"
               :disabled="busy||!record||deleteCode.trim()!==record.key" @click="emit('confirm',deleteCode)">
        {{ busy ? '删除中…' : '确认永久删除' }}
      </UButton>
    </template>
  </AdminCommonDialog>
</template>
