// 唯一业务快照、请求顺序和轮询生命周期；可见性由组件通知，不在 SSR 启动计时器。
import {ref, watch, onScopeDispose} from 'vue'
import {defineStore} from 'pinia'
import type {EnvironmentData} from '#shared/types/admin/environment'
import {createEnvironmentApi} from '~/api/admin/environment'
import {ENVIRONMENT_POLL_INTERVAL_MS} from '~/config/admin/environment'
import {useAdminRequestStore} from './request'
import {useAdminSessionStore} from './session'

export const useAdminEnvironmentStore = defineStore('admin-environment', () => {
    const api = useAdminRequestStore(), requests = createEnvironmentApi(api), session = useAdminSessionStore()
    const data = ref<EnvironmentData | null>(null), pending = ref(false), error = ref(''), stale = ref(false)
    const pollingPaused = ref(false)
    let revision = 0, active = false, timer: ReturnType<typeof setTimeout> | undefined, polling = false, pollRevision = 0

    async function load() {
        if (!active || pending.value) return
        const request = ++revision, generation = session.generation
        pending.value = true
        error.value = ''
        try {
            await api.refreshPermissions()
            if (!active || request !== revision || generation !== session.generation) return
            if (!session.can('system.environment.read')) { data.value = null; return }
            const next = await requests.getEnvironment()
            if (active && request === revision && generation === session.generation && session.can('system.environment.read')) {
                data.value = next
                stale.value = false
            }
        } catch (cause) {
            if (active && request === revision && generation === session.generation) {
                error.value = api.message(cause)
                stale.value = data.value !== null
            }
        } finally {
            if (request === revision && generation === session.generation) pending.value = false
        }
    }
    async function refresh() { await load(); if (error.value) throw new Error(error.value) }
    async function enter() { leave(); active = true; data.value = null; error.value = ''; stale.value = false; await load() }
    function stopPolling() { pollRevision++; polling = false; if (timer) clearTimeout(timer); timer = undefined }
    function schedule(run = pollRevision) {
        if (run !== pollRevision || !polling || !active) return
        timer = setTimeout(async () => {
            timer = undefined
            if (run !== pollRevision || !polling || !active) return
            if (!pollingPaused.value && !pending.value) await load()
            schedule(run)
        }, ENVIRONMENT_POLL_INTERVAL_MS)
    }
    function startPolling() { stopPolling(); if (!session.can('system.environment.read')) return; active = true; polling = true; schedule() }
    function leave() { active = false; revision++; pending.value = false; stopPolling() }
    function clear() { leave(); data.value = null; error.value = ''; stale.value = false }
    watch(() => session.generation, clear, {flush: 'sync'})
    watch(() => session.can('system.environment.read'), allowed => { if (!allowed) clear() }, {flush: 'sync'})
    onScopeDispose(leave)
    return {data, pending, error, stale, pollingPaused, enter, refresh, startPolling, stopPolling, leave}
})
