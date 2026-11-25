import type {AdminDetailLabel, AdminDetailParent} from '~/types/admin/navigation'
import type {MaybeRefOrGetter} from 'vue'

// 将详情页的面包屑交给后台框架展示。
export function useAdminDetailLabel(label: MaybeRefOrGetter<string | undefined>, parents: MaybeRefOrGetter<AdminDetailParent[]> = []) {
    const route = useRoute()
    const state = useState<AdminDetailLabel | null>('admin-detail-label', () => null)
    let owned: AdminDetailLabel | null = null
    function clear() {
        if (owned && state.value === owned) state.value = null
        owned = null
    }
    watch([() => route.path, () => toValue(label), () => toValue(parents)], ([path, value, values]) => {
        if (!value) return clear()
        state.value = {path, label: value, ...(values.length ? {parents: values} : {})}
        owned = state.value
    }, {immediate: true})
    onScopeDispose(clear)
}
