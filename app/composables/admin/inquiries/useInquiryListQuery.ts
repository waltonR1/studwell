import type {InquiryListQuery} from '#shared/schemas/admin/inquiries'
import {
    buildInquiryListQuery,
    inquiryListDateProblem,
    readInquiryListRoute,
    type InquiryFilterKey,
    type InquiryListDraft,
} from '~/utils/admin/inquiries/list-query'

export function useInquiryListQuery(path: string, defaultPageSize: InquiryListQuery['pageSize']) {
    const route = useRoute()
    const filterError = ref('')
    const applied = computed(() => readInquiryListRoute(route.query, defaultPageSize))
    const draft = reactive<InquiryListDraft>({
        search: applied.value.search ?? '',
        queue: applied.value.queue ?? '',
        status: applied.value.status ?? '',
        category: applied.value.category ?? '',
        assigneeId: applied.value.assigneeId ?? '',
        from: applied.value.from ?? '',
        to: applied.value.to ?? '',
        pageSize: String(applied.value.pageSize),
    })
    watch(applied, value => {
        draft.search = value.search ?? ''
        draft.queue = value.queue ?? ''
        draft.status = value.status ?? ''
        draft.category = value.category ?? ''
        draft.assigneeId = value.assigneeId ?? ''
        draft.from = value.from ?? ''
        draft.to = value.to ?? ''
        draft.pageSize = String(value.pageSize)
    })

    function validate(value: InquiryListQuery) {
        filterError.value = inquiryListDateProblem(value)
        return !filterError.value
    }

    function navigate(value: InquiryListQuery) {
        if (!validate(value)) return Promise.resolve()
        return navigateTo({
            path,
            query: {
                ...(value.search ? {search:value.search} : {}),
                ...(value.queue ? {queue:value.queue} : {}),
                ...(value.status ? {status:value.status} : {}),
                ...(value.category ? {category:value.category} : {}),
                ...(value.assigneeId ? {assigneeId:value.assigneeId} : {}),
                ...(value.from ? {from:value.from} : {}),
                ...(value.to ? {to:value.to} : {}),
                page: String(value.page),
                pageSize: String(value.pageSize),
            },
        })
    }

    const submitSearch = () => navigate(buildInquiryListQuery(applied.value, draft, {type:'search'}, defaultPageSize))
    const applyFilter = (key: InquiryFilterKey) =>
        navigate(buildInquiryListQuery(applied.value, draft, {type:'filter', key}, defaultPageSize))
    const selectQueue = () => navigate(buildInquiryListQuery(applied.value, draft, {type:'queue'}, defaultPageSize))
    const applyPageSize = () => navigate(buildInquiryListQuery(applied.value, draft, {type:'pageSize'}, defaultPageSize))
    const goToPage = (page: number) =>
        navigate(buildInquiryListQuery(applied.value, draft, {type:'page', page}, defaultPageSize))

    return {
        applied, draft, filterError,
        page: computed(() => applied.value.page),
        apiQuery: applied,
        submitSearch, applyFilter, selectQueue, applyPageSize, goToPage,
    }
}
