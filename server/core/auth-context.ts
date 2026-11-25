// 认证操作者的请求元数据合同，不依赖 HTTP 事件。
export interface AuthMeta {
    ip: string;
    userAgent: string;
    requestId: string;
    requestMethod?: string;
    routeTemplate?: string;
    permissionCode?: string;
    rateLimitScope?: string
}
