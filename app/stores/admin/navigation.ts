// 后台导航数据、加载状态和更新标记；请求函数及 route 由框架层在调用时提供。
import {ref} from 'vue'
import {defineStore} from 'pinia'
import type {AdminNavigationContext} from '~/types/admin/navigation'
import type {NavigationData} from '#shared/types/admin/menus'
import {adminRequestMessage} from '~/utils/admin/request/errors'


export const useAdminNavigationStore = defineStore('admin-navigation', () => {
    const data = ref<NavigationData | null>(null)
    const pending = ref(false)
    const error = ref('')
    const revision = ref(0)
    const identityKey = ref('')
    const stale = ref(true)
    let sequence = 0
    let loadPromise: Promise<boolean> | null = null

    function reset() {
        sequence++
        loadPromise = null
        data.value = null
        pending.value = false
        error.value = ''
        identityKey.value = ''
        stale.value = true
    }

    function invalidate() {
        sequence++
        loadPromise = null
        pending.value = false
        stale.value = true
        revision.value++
    }

    function leave() {
        reset()
    }

    async function load(
        request: () => Promise<NavigationData>,
        context: AdminNavigationContext,
        force = false,
    ) {
        if (!context.active) {
            leave()
            return true
        }
        const key = `${context.generation}:${context.ownerId}`
        const identityChanged = identityKey.value !== key
        if (identityChanged) {
            sequence++
            loadPromise = null
            pending.value = false
            data.value = null
            identityKey.value = key
            stale.value = true
            error.value = ''
        }
        if (loadPromise && !force)
            return loadPromise
        if (!force && !stale.value && data.value)
            return true
        const requestSequence = ++sequence
        pending.value = true
        error.value = ''
        loadPromise = (async () => {
            try {
                const next = await request()
                if (requestSequence !== sequence || identityKey.value !== key)
                    return false
                data.value = next
                stale.value = false
                return true
            } catch (cause) {
                if (requestSequence === sequence && identityKey.value === key) {
                    data.value = null
                    stale.value = true
                    error.value = adminRequestMessage(cause)
                }
                return false
            } finally {
                if (requestSequence === sequence) {
                    pending.value = false
                    loadPromise = null
                }
            }
        })()
        return loadPromise
    }

    async function enter(
        request: () => Promise<NavigationData>,
        context: AdminNavigationContext,
    ) {
        return load(request, context)
    }

    async function refresh(
        request: () => Promise<NavigationData>,
        context: AdminNavigationContext,
    ) {
        return load(request, context, true)
    }

    return {
        data,
        pending,
        error,
        revision,
        identityKey,
        stale,
        reset,
        invalidate,
        leave,
        enter,
        load,
        refresh,
    }
})
