// 当前管理账号的分页偏好；按账号缓存，并按身份代次与请求顺序接收响应。
import {ref, watch} from 'vue'
import {defineStore} from 'pinia'
import type {AdminPreferences, PreferenceResponse} from '#shared/types/admin/parameters'
import type {PreferenceQueryInput} from '#shared/schemas/admin/parameters'
import {useAdminRequestStore} from '~/stores/admin/request'
import {useAdminSessionStore} from './session'

import {DEFAULT_ADMIN_PAGE_SIZE} from '#shared/config/admin/pagination'

export const useAdminPreferencesStore = defineStore('admin-preferences', () => {
    const session = useAdminSessionStore(), api = useAdminRequestStore()
    const byActor = ref<Record<string, AdminPreferences>>({})
    const pending = ref<Record<string, boolean>>({})
    const errors = ref<Record<string, string>>({})
    const sequences = ref<Record<string, number>>({})
    const actorPromises: Record<string, Promise<void> | undefined> = {}

    function pageSize(actorId: string) {
        // 偏好接口的有效值优先；尚未取得该账号偏好时才使用本地回退，不覆盖已缓存的有效值。
        return byActor.value[actorId]?.pageSize ?? DEFAULT_ADMIN_PAGE_SIZE
    }

    function reset() {
        byActor.value = {}
        pending.value = {}
        errors.value = {}
        sequences.value = {}
        for (const key of Object.keys(actorPromises))
            delete actorPromises[key]
    }

    async function load(actorId = session.currentUser?.id ?? 'anonymous') {
        if (actorPromises[actorId])
            return actorPromises[actorId]
        const generation = session.generation
        const sequence = (sequences.value[actorId] ?? 0) + 1
        sequences.value[actorId] = sequence
        pending.value[actorId] = true
        errors.value[actorId] = ''
        const request = (async () => {
            try {
                const result = await api.read<PreferenceResponse>('auth/preferences', {
                    version: byActor.value[actorId]?.version,
                } satisfies PreferenceQueryInput)
                if (
                    generation !== session.generation
                    || sequence !== sequences.value[actorId]
                )
                    return
                if (result.changed)
                    byActor.value[actorId] = {
                        version: result.version,
                        pageSize: result.pageSize,
                    }
            } catch (error) {
                if (
                    generation !== session.generation
                    || sequence !== sequences.value[actorId]
                )
                    return
                errors.value[actorId] = api.message(error)
                const currentActor = session.currentUser?.id ?? 'anonymous'
                if (session.session?.authenticated && currentActor === actorId) {
                    throw Object.assign(new Error('后台分页配置读取失败，请刷新重试'), {
                        statusCode: 503,
                    })
                }
            } finally {
                if (
                    generation === session.generation
                    && sequence === sequences.value[actorId]
                ) {
                    pending.value[actorId] = false
                    delete actorPromises[actorId]
                }
            }
        })()
        actorPromises[actorId] = request
        return request
    }

    watch(
        () => session.generation,
        () => reset(),
    )

    return {byActor, pending, errors, pageSize, load, reset}
})
