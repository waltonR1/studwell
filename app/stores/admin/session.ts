// 后台身份、权限及请求代次的唯一状态入口；请求协调由 request store 负责，不反向依赖业务 store。
import {computed, ref} from 'vue'
import {defineStore} from 'pinia'
import type {AdminAuthRecovery} from '~/types/admin/session'
import type {AdminSessionState} from '#shared/types/admin/auth'
import type {AdminPermissions} from '#shared/types/admin/roles'
import {useAdminNoticeStore} from './notice'


export const useAdminSessionStore = defineStore('admin-session', () => {
    const session = ref<AdminSessionState | null>(null)
    const permissions = ref<AdminPermissions | null>(null)
    const recovery = ref<AdminAuthRecovery | null>(null)
    const generation = ref(0)
    const transition = ref<'reset'|'expired'|'switch'|'login'|'logout'|'password-change'>('reset')
    const notice = useAdminNoticeStore()

    const currentUser = computed(() => session.value?.user ?? null)
    const authenticated = computed(() =>
        session.value?.authenticated === true && !session.value.mustChangePassword,
    )
    const isRoot = computed(() => permissions.value?.isRoot === true)

    function can(code: string) {
        return !!permissions.value
            && (permissions.value.isRoot || permissions.value.permissions.includes(code))
    }

    function resetIdentity(reason: typeof transition.value = 'reset') {
        transition.value = reason
        generation.value++
        session.value = null
        permissions.value = null
        recovery.value = null
        notice.clearNotice()
    }

    function acceptSession(next: AdminSessionState, expectedGeneration: number) {
        if (expectedGeneration !== generation.value)
            return false
        const previousUser = session.value?.authenticated ? session.value.user : null
        const identityEnded = !!previousUser && !next.authenticated
        const identitySwitched = !!previousUser
            && next.authenticated
            && !!next.user
            && previousUser.id !== next.user.id
        if (identityEnded || identitySwitched)
            resetIdentity(identitySwitched ? 'switch' : 'expired')
        if (!next.authenticated || next.mustChangePassword)
            permissions.value = null
        session.value = next
        if (next.authenticated)
            recovery.value = null
        return true
    }

    function acceptPermissions(next: AdminPermissions, expectedGeneration: number) {
        if (
            expectedGeneration !== generation.value
            || !session.value?.authenticated
            || session.value.mustChangePassword
        )
            return false
        permissions.value = next
        return true
    }

    function markExpired(returnTo: string) {
        if (!session.value || session.value.authenticated)
            resetIdentity('expired')
        else {
            permissions.value = null
            notice.clearNotice()
        }
        recovery.value = {kind: 'expired', returnTo}
    }

    function markPasswordChangeRequired(returnTo: string) {
        transition.value = 'password-change'
        generation.value++
        permissions.value = null
        notice.clearNotice()
        recovery.value = {kind: 'password-change', returnTo}
    }

    return {
        session,
        permissions,
        recovery,
        generation,
        transition,
        currentUser,
        authenticated,
        isRoot,
        can,
        resetIdentity,
        acceptSession,
        acceptPermissions,
        markExpired,
        markPasswordChangeRequired,
    }
})
