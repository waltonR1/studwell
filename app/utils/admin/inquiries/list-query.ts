import {inquiryQueues, inquiryStatuses, type InquiryListQuery} from '#shared/schemas/admin/inquiries'
import {entityIdSchema} from '#shared/schemas/entity'
import {inquiryCategoryCode} from '#shared/schemas/public/inquiries'
import {readAdminPage, readAdminPageSize} from '~/utils/admin/list/query'

export type InquiryFilterKey = 'queue' | 'status' | 'category' | 'assigneeId' | 'from' | 'to'
export interface InquiryListDraft {
    search: string
    queue: string
    status: string
    category: string
    assigneeId: string
    from: string
    to: string
    pageSize: string
}
export type InquiryListAction =
    | {type:'search'}
    | {type:'filter'; key:InquiryFilterKey}
    | {type:'queue'}
    | {type:'pageSize'}
    | {type:'page'; page:number}

function first(value: unknown) {
    if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : ''
    return typeof value === 'string' ? value : ''
}

function allowed(value: string, options: readonly string[]) {
    return options.includes(value) ? value : ''
}

function date(value: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T00:00:00Z')) ? value : ''
}

export function readInquiryListRoute(query: Record<string, unknown>, defaultPageSize: InquiryListQuery['pageSize']): InquiryListQuery {
    const pageSize = readAdminPageSize(query.pageSize) ?? defaultPageSize
    const from = date(first(query.from))
    const toValue = date(first(query.to))
    const category = inquiryCategoryCode.safeParse(first(query.category))
    const assigneeId = entityIdSchema.safeParse(first(query.assigneeId))
    return {
        search: first(query.search).trim().slice(0, 254) || undefined,
        queue: (allowed(first(query.queue), inquiryQueues) || undefined) as InquiryListQuery['queue'],
        status: (allowed(first(query.status), inquiryStatuses) || undefined) as InquiryListQuery['status'],
        category: category.success ? category.data : undefined,
        assigneeId: assigneeId.success ? assigneeId.data : undefined,
        from: from || undefined,
        to: from && toValue && from <= toValue ? toValue : undefined,
        page: readAdminPage(query.page, pageSize),
        pageSize,
    }
}

function filterValue(key: InquiryFilterKey, value: string) {
    if (!value) return undefined
    if (key === 'queue') return allowed(value, inquiryQueues) || undefined
    if (key === 'status') return allowed(value, inquiryStatuses) || undefined
    if (key === 'category') {
        const category = inquiryCategoryCode.safeParse(value)
        return category.success ? category.data : undefined
    }
    if (key === 'assigneeId') {
        const assigneeId = entityIdSchema.safeParse(value)
        return assigneeId.success ? assigneeId.data : undefined
    }
    return date(value) || undefined
}

export function inquiryListDateProblem(value: Pick<InquiryListQuery, 'from' | 'to'>) {
    return value.from && value.to && value.from > value.to ? '结束日期不能早于开始日期。' : ''
}

export function buildInquiryListQuery(
    applied: InquiryListQuery,
    draft: InquiryListDraft,
    action: InquiryListAction,
    defaultPageSize: InquiryListQuery['pageSize'],
): InquiryListQuery {
    let value: InquiryListQuery = {...applied}
    if (action.type === 'search') {
        value = {
            ...applied,
            search: draft.search.trim() || undefined,
            queue: filterValue('queue', draft.queue),
            status: filterValue('status', draft.status),
            category: filterValue('category', draft.category),
            assigneeId: filterValue('assigneeId', draft.assigneeId),
            from: filterValue('from', draft.from),
            to: filterValue('to', draft.to),
            page: 1,
        } as InquiryListQuery
    } else if (action.type === 'filter') {
        value = {...applied, [action.key]:filterValue(action.key, draft[action.key]), page:1} as InquiryListQuery
    } else if (action.type === 'queue') {
        value = {...applied, queue:filterValue('queue', draft.queue), status:undefined, assigneeId:undefined, page:1} as InquiryListQuery
    } else if (action.type === 'pageSize') {
        value = {...applied, page:1, pageSize:readAdminPageSize(draft.pageSize) ?? defaultPageSize}
    } else {
        value = {...applied, page:readAdminPage(String(action.page), applied.pageSize)}
    }
    return value
}
