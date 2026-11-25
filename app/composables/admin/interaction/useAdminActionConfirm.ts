import type {AdminConfirmation} from '~/types/admin/interaction'
import {onScopeDispose, ref} from 'vue'

// 页面作用域确认实例；卸载时取消挂起确认，不持有业务请求。
export function useAdminActionConfirm() {
    const state = ref<AdminConfirmation | null>(null)
    let resolve: ((accepted: boolean) => void) | undefined

    function settle(accepted: boolean) {
        const pending = resolve
        resolve = undefined
        state.value = null
        pending?.(accepted)
    }

    function ask(options: AdminConfirmation) {
        settle(false)
        state.value = options
        return new Promise<boolean>(done => {
            resolve = done
        })
    }

    onScopeDispose(() => settle(false))
    return {state, ask, settle}
}
