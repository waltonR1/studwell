import type {MaybeRefOrGetter} from 'vue'
import type {AdminConfirmation} from '~/types/admin/interaction'

export function useAdminUnsavedGuard(
    dirty: MaybeRefOrGetter<boolean>,
    message: string,
    active: MaybeRefOrGetter<boolean> = true,
    confirmOverride?: (message: string) => Promise<boolean>,
) {
    const confirm = inject<(request: AdminConfirmation) => Promise<boolean>>('admin-confirm')
    if (!confirm) throw new Error('管理端确认框需要 admin Layout')
    const askConfirmation = confirm
    const shouldGuard = computed(() => toValue(active) && toValue(dirty))

    async function guard() {
        return !shouldGuard.value || (confirmOverride
            ? confirmOverride(message)
            : askConfirmation({
                title: '放弃未保存的修改？',
                message,
                cancelLabel: '继续编辑',
                confirmLabel: '放弃修改',
            }))
    }

    onBeforeRouteLeave(() => guard())
    if (import.meta.client) {
        function beforeUnload(event: BeforeUnloadEvent) {
            if (!shouldGuard.value) return
            event.preventDefault()
            event.returnValue = ''
        }

        onMounted(() => window.addEventListener('beforeunload', beforeUnload))
        onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
    }
    return {shouldGuard, guard}
}
