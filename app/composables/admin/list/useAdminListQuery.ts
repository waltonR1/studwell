import {
    buildAdminListQuery,
    readAdminListRoute,
} from '~/utils/admin/list/query'
import type {AdminListAction, AdminListDraft, UseAdminListQueryOptions} from '~/types/admin/list'

export function useAdminListQuery(options: UseAdminListQueryOptions) {
    const route = useRoute()
    const applied = computed(() => readAdminListRoute(route.query, options.filterKey, options.filterValues))
    const initial = applied.value
    const draft = reactive<AdminListDraft>({
        search: initial.search,
        filter: initial.filter,
        pageSize: String(initial.pageSize ?? options.defaultPageSize),
    })

    watch(() => applied.value.search, value => {
        draft.search = value
    })
    watch(() => applied.value.filter, value => {
        draft.filter = value
    })
    watch(() => applied.value.pageSize, value => {
        if (value !== undefined) draft.pageSize = String(value)
    })

    const apiQuery = computed(() => ({
        search: applied.value.search,
        ...(applied.value.filter ? {[options.filterKey]: applied.value.filter} : {}),
        page: applied.value.page,
        pageSize: applied.value.pageSize,
    }))

    async function navigate(action: AdminListAction) {
        const query = buildAdminListQuery({
            applied: applied.value,
            draft: draft,
            action,
            filterKey: options.filterKey,
            paginated: options.paginated,
        })
        await navigateTo({path: options.path, query})
    }

    return {
        applied,
        draft,
        page: computed(() => applied.value.page),
        apiQuery,
        submitSearch: () => navigate({type: 'search'}),
        applyFilter: () => navigate({type: 'filter'}),
        applyPageSize: () => navigate({type: 'pageSize'}),
        goToPage: (page: number) => navigate({type: 'page', page}),
    }
}
