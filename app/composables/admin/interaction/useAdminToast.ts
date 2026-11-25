import type {AdminToastNotification} from '~/types/admin/interaction'
import {ref} from 'vue'

// 页面作用域，不缓存业务数据；重复提示也创建新对象以重新计时。
export function useAdminToast() {
    const notification = ref<AdminToastNotification | null>(null)

    function show(message: string, tone: AdminToastNotification['tone'] = 'success') {
        if (message.trim()) notification.value = {message, tone}
    }

    function dismiss() {
        notification.value = null
    }

    return {notification, show, dismiss}
}
