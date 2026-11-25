// 官网静态路径拼接及保留路径校验，语言前缀来自统一资源目录。
import {supportedLocales} from '../../config/site-languages'

export function websiteChildPath(base: string, slug: string) {
    return (base === '/' ? '' : base) + '/' + slug
}

export const websiteRoutePathPattern = /^\/[a-z][a-z0-9_-]{0,63}$/
const reservedPaths = new Set(['/admin', '/api', '/search', '/uploads', '/_nuxt', '/_ipx', ...supportedLocales.map(locale => '/' + locale)])

export function isWebsiteRoutePath(path: string) {
    return path === '/' || websiteRoutePathPattern.test(path) && !reservedPaths.has(path)
}
