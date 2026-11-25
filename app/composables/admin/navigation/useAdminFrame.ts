import type {AdminDetailLabel} from '~/types/admin/navigation'
// 后台框架协调：连接身份、导航 store、当前页刷新和仅属于组件的 DOM 交互。
import {computed, watch} from 'vue'
import {storeToRefs} from 'pinia'
import {useAdminRequestStore} from '~/stores/admin/request'
import {useAdminToast} from '~/composables/admin/interaction/useAdminToast'
import {provideAdminRefreshRegistry} from '~/composables/admin/navigation/useAdminRefresh'
import {createMenusApi} from '~/api/admin/menus'
import {useAdminSessionStore} from '~/stores/admin/session'
import {useAdminNavigationStore} from '~/stores/admin/navigation'
import {useAdminNavigationPreferences} from './useAdminNavigationPreferences'

export function useAdminFrame(props: Readonly<{
    active: boolean
}>) {
    const api = useAdminRequestStore(), route = useRoute(), menus = createMenusApi(api)
    const {write} = api
    const auth = useAdminSessionStore()
    const {session} = storeToRefs(auth)
    const navigationState = useAdminNavigationStore()
    const {data: navigation, error, pending, revision} = storeToRefs(navigationState)
    const refreshRegistry = provideAdminRefreshRegistry()
    const owner = computed(() => session.value?.user?.id ?? '')
    const preferences = useAdminNavigationPreferences(props, owner)
    const {userMenuOpen, busy, refreshStatus} = preferences
    const {notification, show: notify} = useAdminToast()
    const refreshing = refreshRegistry.refreshing
    const detailLabel = useState<AdminDetailLabel | null>('admin-detail-label', () => null)
    const fetcher = () => menus.getNavigation()
    const context = () => ({
        ownerId: owner.value,
        generation: auth.generation,
        active: props.active,
    })

    const ready = props.active
        ? navigationState.enter(fetcher, context())
        : Promise.resolve(navigationState.leave()).then(() => true)

    watch(
        [() => props.active, owner, () => auth.generation, revision],
        async () => {
            if (!props.active) {
                navigationState.leave()
                return
            }
            await navigationState.enter(fetcher, context())
        },
    )
    watch(
        () => route.path,
        () => {
            if (props.active)
                navigationState.invalidate()
        },
    )

    const items = computed(() => navigation.value?.items ?? [])
    const parents = computed(() => new Map(items.value.map(item => [item.id, item])))
    const visibleItems = computed(() => items.value.flatMap(item => {
        let parent = item.parentId ? parents.value.get(item.parentId) : undefined, depth = 0
        while (parent) {
            if (preferences.closed.value.includes(parent.code))
                return []
            depth++
            parent = parent.parentId ? parents.value.get(parent.parentId) : undefined
        }
        return [{...item, depth}]
    }))
    const currentPage = computed(() => items.value
        .filter(item => item.path && (route.path === item.path || route.path.startsWith(item.path + '/')))
        .sort((a, b) => (b.path?.length ?? 0) - (a.path?.length ?? 0))[0])
    const currentAncestors = computed(() => {
        const ids = new Set<string>()
        let item = currentPage.value
        while (item?.parentId) {
            ids.add(item.parentId)
            item = parents.value.get(item.parentId)
        }
        return ids
    })
    const crumbs = computed(() => {
        const result = []
        let item = currentPage.value
        while (item) {
            result.unshift(item)
            item = item.parentId ? parents.value.get(item.parentId) : undefined
        }
        return result
    })
    const visibleCrumbs = computed(() =>
        preferences.isCompact.value ? crumbs.value.slice(-2) : crumbs.value,
    )
    const contextTitle = computed(() => {
        if (route.path === '/admin')
            return '管理后台'
        if (route.path === '/admin/forbidden')
            return '没有访问权限'
        return currentPage.value?.name ?? String(route.meta.adminTitle ?? '后台管理')
    })
    const userName = computed(() =>
        session.value?.user?.displayName || session.value?.user?.username || '当前用户',
    )
    const userInitial = computed(() => userName.value.trim().slice(0, 1).toUpperCase())
    const userRole = computed(() => session.value?.user?.isRoot ? '超级管理员' : '管理员')

    function firstAccessibleDescendantPath(id: string): string | null {
        for (const child of items.value.filter(item => item.parentId === id)) {
            if (child.path)
                return child.path
            const nested = firstAccessibleDescendantPath(child.id)
            if (nested)
                return nested
        }
        return null
    }

    function crumbDestination(crumb: (typeof items.value)[number]) {
        if (crumb.id === currentPage.value?.id)
            return route.params.id ? crumb.path : null
        return crumb.path ?? firstAccessibleDescendantPath(crumb.id)
    }

    async function refreshNavigation() {
        return navigationState.refresh(fetcher, context())
    }

    async function refreshCurrentPage() {
        if (refreshing.value || refreshRegistry.blocked.value)
            return
        userMenuOpen.value = false
        notification.value = null
        refreshStatus.value = ''
        refreshing.value = true
        try {
            if (!await refreshRegistry.confirm() || refreshRegistry.blocked.value)
                return
            await api.refreshPermissions()
            if (!await refreshNavigation()) {
                refreshStatus.value = '刷新失败'
                notify(error.value || '导航刷新失败', 'error')
                return
            }
            await refreshRegistry.refresh()
            refreshStatus.value = '当前页面已刷新'
        } catch (cause) {
            notify(api.operationMessage(cause), 'error')
            refreshStatus.value = '刷新失败'
        } finally {
            refreshing.value = false
        }
    }

    async function logout() {
        userMenuOpen.value = false
        busy.value = true
        try {
            await write('logout')
            navigationState.reset()
            await navigateTo('/admin/login')
        } catch (cause) {
            notify(api.operationMessage(cause), 'error')
        } finally {
            busy.value = false
        }
    }

    return {
        ...preferences,
        error,
        pending,
        items,
        visibleItems,
        currentPage,
        currentAncestors,
        visibleCrumbs,
        contextTitle,
        detailLabel,
        crumbDestination,
        userName,
        userInitial,
        userRole,
        session,
        refreshRegistry,
        notification,
        refreshing,
        refreshCurrentPage,
        logout,
        ready,
    }
}
