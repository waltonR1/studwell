// 校验后台返回地址：仅接受本站 /admin 路径，排除认证页及编码分隔符；不执行跳转。
export function safeAdminRedirect(value: unknown, fallback = '/admin') {
    const candidate = Array.isArray(value) ? value[0] : value
    if (typeof candidate !== 'string' || !candidate.startsWith('/admin')) return fallback
    if (candidate.includes('\\') || /%(?:2f|5c)/i.test(candidate)) return fallback
    try {
        const url = new URL(candidate, 'http://admin.local')
        if (url.origin !== 'http://admin.local' || !(url.pathname === '/admin' || url.pathname.startsWith('/admin/'))) return fallback
        if (url.pathname === '/admin/login' || url.pathname === '/admin/change-password') return fallback
        return `${url.pathname}${url.search}${url.hash}`
    } catch {
        return fallback
    }
}
