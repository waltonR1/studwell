// 首页只持有统计快照；导航链接直接投影导航 store，不建立第二份导航缓存。
import {computed, ref, watch, onScopeDispose} from 'vue'
import {defineStore} from 'pinia'
import type {DashboardData} from '#shared/types/admin/dashboard'
import {createDashboardApi} from '~/api/admin/dashboard'
import {useAdminRequestStore} from '~/stores/admin/request'
import {dashboardMetrics} from '~/config/admin/dashboard'
import {dashboardLinks} from '~/utils/admin/dashboard/links'
import {useAdminSessionStore} from './session'
import {useAdminNavigationStore} from './navigation'

export const useAdminDashboardStore = defineStore('admin-dashboard', () => {
    const session = useAdminSessionStore(), navigation = useAdminNavigationStore()
    const api = useAdminRequestStore(), requests = createDashboardApi(api)
    const overview = ref<DashboardData | null>(null), pending = ref(false), error = ref('')
    let revision = 0
    const navigationItems = computed(() => navigation.data?.items ?? [])
    const links = computed(() => dashboardLinks(navigation.data?.items ?? []))
    const metrics = computed(() => dashboardMetrics.filter(item => overview.value && Object.hasOwn(overview.value.stats, item.key)))
    const userName = computed(() => session.currentUser?.displayName || session.currentUser?.username || '管理员')
    const navigationIcons = computed(() => new Map((navigation.data?.items ?? []).map(item => [item.id, item.iconKey])))
    async function load() {
        const request = ++revision, generation = session.generation
        pending.value = true
        error.value = ''
        try {
            await api.refreshPermissions()
            if (request !== revision || generation !== session.generation) return
            const result = session.can('system.dashboard.read') ? await requests.getDashboard() : null
            if (request === revision && generation === session.generation) overview.value = result
        } catch (cause) {
            if (request === revision && generation === session.generation) error.value = api.message(cause)
        } finally {
            if (request === revision && generation === session.generation) pending.value = false
        }
    }
    async function refresh() {
        await load()
        if (error.value) throw new Error(error.value)
    }
    function leave() {
        revision++
        pending.value = false
    }
    watch(() => session.generation, () => {
        leave()
        overview.value = null
        error.value = ''
    }, {flush: 'sync'})
    onScopeDispose(leave)
    return {overview, navigationItems, pending, error, links, metrics, userName, navigationIcons, load, refresh, leave}
})
