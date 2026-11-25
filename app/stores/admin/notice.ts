// 全局后台请求横幅；页面 Toast、确认框及表单错误仍由组件作用域持有。
import {defineStore} from 'pinia'
import type {AdminNotice} from '~/types/admin/notice'
import {ref} from 'vue'


export const useAdminNoticeStore = defineStore('admin-notice', () => {
    const notice = ref<AdminNotice | null>(null)

    function setNotice(value: AdminNotice) {
        notice.value = value
    }

    function clearNotice() {
        notice.value = null
    }

    return {notice, setNotice, clearNotice}
})
