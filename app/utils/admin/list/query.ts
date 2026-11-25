// 后台列表 URL 查询的读取与构造，区分输入草稿和已应用条件；不执行导航或请求。
import {ADMIN_PAGE_SIZES} from '#shared/config/admin/pagination'
import type {AdminListRouteState, BuildAdminListQueryOptions} from '~/types/admin/list'

const MAX_ADMIN_PAGE_SIZE = Math.max(...ADMIN_PAGE_SIZES)

function firstQueryValue(value: unknown) {
    if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : ''
    return typeof value === 'string' ? value : ''
}

export function readAdminPage(value: unknown, pageSize = MAX_ADMIN_PAGE_SIZE) {
    const text = firstQueryValue(value)
    if (!/^[1-9]\d*$/.test(text)) return 1
    const page = Number(text)
    const offset = (page - 1) * (pageSize ?? MAX_ADMIN_PAGE_SIZE)
    return Number.isSafeInteger(page) && page > 0 && Number.isSafeInteger(offset) ? page : 1
}

export function readAdminPageSize(value: unknown) {
    const text = firstQueryValue(value)
    return ADMIN_PAGE_SIZES.find(size => String(size) === text)
}

export function readAdminListRoute(
    query: Record<string, unknown>,
    filterKey: string,
    filterValues: readonly string[],
): AdminListRouteState {
    const filter = firstQueryValue(query[filterKey])
    const pageSize = readAdminPageSize(query.pageSize)
    return {
        search: firstQueryValue(query.search),
        filter: filterValues.includes(filter) ? filter : '',
        page: readAdminPage(query.page, pageSize),
        pageSize,
    }
}

export function buildAdminListQuery({
                                        applied,
                                        draft,
                                        action,
                                        filterKey,
                                        paginated = true,
                                    }: BuildAdminListQueryOptions) {
    let search = applied.search
    let filter = applied.filter
    let page = applied.page
    let pageSize = applied.pageSize

    if (action.type === 'search') {
        search = draft.search.trim()
        page = 1
    } else if (action.type === 'filter') {
        filter = draft.filter
        page = 1
    } else if (action.type === 'pageSize') {
        pageSize = readAdminPageSize(draft.pageSize)
        page = 1
    } else {
        page = readAdminPage(String(action.page), pageSize)
    }

    return {
        ...(search ? {search} : {}),
        ...(filter ? {[filterKey]: filter} : {}),
        ...(paginated ? {page: String(page)} : {}),
        ...(paginated && pageSize !== undefined ? {pageSize: String(pageSize)} : {}),
    }
}
