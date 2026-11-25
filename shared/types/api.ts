// 前后端共用的 HTTP 响应、分页及受控错误合同，不包含具体业务数据。
export interface ApiFieldError {
    path: string;
    message: string
}

export type ApiConflictReason =
    'STALE'
    | 'DUPLICATE'
    | 'REFERENCED'
    | 'PAGE_CONFIGURED'
    | 'PAGE_LINKED'
    | 'DEPENDENCY_UNAVAILABLE'
    | 'RETRY'

export interface ApiSuccess<T> {
    success: true;
    data: T;
    requestId: string
}

export interface ApiFailure {
    success: false
    error: { code: string; message: string; reason?: ApiConflictReason; fields?: ApiFieldError[] }
    requestId: string
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure

export interface PageData<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number
}
