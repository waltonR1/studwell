import {ADMIN_COMPACT_NAVIGATION_QUERY} from '~/config/admin/navigation'
// 后台导航偏好与交互生命周期，桌面折叠和移动端抽屉分别维护。
import {computed, ref, watch, onMounted, onBeforeUnmount} from 'vue'
import type {Ref} from 'vue'

export function useAdminNavigationPreferences(props: Readonly<{
    active: boolean
}>, owner: Readonly<Ref<string>>) {
    const route = useRoute()
    const collapsed = ref(false), closed = ref<string[]>([]), busy = ref(false)
    const isCompact = ref(false), mobileOpen = ref(false), userMenuOpen = ref(false)
    const refreshStatus = ref('')
    const railCollapsed = computed(() => collapsed.value && !isCompact.value)
    const navigationExpanded = computed(() => isCompact.value ? mobileOpen.value : !collapsed.value)
    const navigationTooltip = ref<{
        label: string
        top: number
    } | null>(null)
    const storageKey = computed(() => `studwell-admin-nav-${owner.value}`)
    let compactMedia: MediaQueryList | undefined
    let storageOwner = ''

    function syncCompact() {
        isCompact.value = compactMedia?.matches ?? false
        if (!isCompact.value)
            mobileOpen.value = false
    }

    function closeUserMenuOnOutside(event: PointerEvent) {
        if (userMenuOpen.value && !(event.target as Element | null)?.closest('.admin-user-menu-wrap'))
            userMenuOpen.value = false
    }

    function handleEscape(event: KeyboardEvent) {
        if (event.key !== 'Escape')
            return
        if (userMenuOpen.value) {
            userMenuOpen.value = false
            return
        }
        if (mobileOpen.value)
            mobileOpen.value = false
    }

    function loadStoredPreferences() {
        storageOwner = owner.value
        mobileOpen.value = false
        userMenuOpen.value = false
        refreshStatus.value = ''
        navigationTooltip.value = null
        if (!storageOwner) {
            collapsed.value = false
            closed.value = []
            return
        }
        try {
            const saved = JSON.parse(localStorage.getItem(storageKey.value) ?? '{}')
            collapsed.value = saved.collapsed === true
            const savedClosed: string[] = Array.isArray(saved.closed) ? saved.closed.filter((value: unknown) => typeof value === 'string') : []
            closed.value = [...new Set(savedClosed.flatMap(code => code === 'system' ? ['account_access', 'system_config', 'logs_audit'] : [code]))]
        } catch { /* 不可用的存储不阻止导航。 */
            collapsed.value = false
            closed.value = []
        }
    }

    onMounted(() => {
        loadStoredPreferences()
        compactMedia = window.matchMedia(ADMIN_COMPACT_NAVIGATION_QUERY)
        syncCompact()
        compactMedia.addEventListener('change', syncCompact)
        document.addEventListener('pointerdown', closeUserMenuOnOutside, true)
        document.addEventListener('keydown', handleEscape)
    })
    onBeforeUnmount(() => {
        compactMedia?.removeEventListener('change', syncCompact)
        document.removeEventListener('pointerdown', closeUserMenuOnOutside, true)
        document.removeEventListener('keydown', handleEscape)
    })
    watch(storageKey, loadStoredPreferences)
    watch([collapsed, closed], () => {
        if (!storageOwner || storageOwner !== owner.value)
            return
        try {
            localStorage.setItem(storageKey.value, JSON.stringify({collapsed: collapsed.value, closed: closed.value}))
        } catch { /* 私密浏览和配额失败时只保留内存状态。 */
        }
    }, {deep: true})
    watch(() => route.fullPath, () => {
        mobileOpen.value = false
        userMenuOpen.value = false
        refreshStatus.value = ''
        navigationTooltip.value = null
    })
    watch(() => props.active, active => {
        if (active)
            return
        mobileOpen.value = false
        userMenuOpen.value = false
    })

    function toggle(code: string) {
        closed.value = closed.value.includes(code) ? closed.value.filter(value => value !== code) : [...closed.value, code]
    }

    function toggleNavigation() {
        if (isCompact.value)
            mobileOpen.value = !mobileOpen.value
        else
            collapsed.value = !collapsed.value
    }

    function showNavigationTooltip(label: string, event: MouseEvent | FocusEvent) {
        if (!railCollapsed.value)
            return
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
        navigationTooltip.value = {label, top: rect.top + rect.height / 2}
    }

    function hideNavigationTooltip() {
        navigationTooltip.value = null;
    }

    return {
        collapsed,
        closed,
        busy,
        isCompact,
        mobileOpen,
        userMenuOpen,
        refreshStatus,
        railCollapsed,
        navigationExpanded,
        navigationTooltip,
        toggle,
        toggleNavigation,
        showNavigationTooltip,
        hideNavigationTooltip
    }
}
