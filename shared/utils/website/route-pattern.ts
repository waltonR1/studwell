// 解析与匹配官网路由模式，仅允许非根路径末尾携带一个动态参数。
import {isWebsiteRoutePath} from './route'

const segment = /^[a-z][a-z0-9_-]{0,63}$/
const parameter = /^:([a-z][a-z0-9_]{0,63})$/

/** A published route may have one parameter, at the end of a non-root path. */
export function parseWebsiteRoutePattern(path: string) {
    if (path === '/') return {segments: [], parameter: null}
    if (!path.startsWith('/')) return null
    const segments = path.slice(1).split('/')
    if (segments.length > 6 || !isWebsiteRoutePath('/' + segments[0])) return null
    const name = segments.length > 1 ? parameter.exec(segments.at(-1)!)?.[1] : undefined
    const fixed = name ? segments.slice(0, -1) : segments
    if (!fixed.every(value => segment.test(value))) return null
    return {segments: fixed, parameter: name ?? null}
}

/** The name of the parameter does not distinguish two sibling patterns. */
export function websiteRoutePatternIdentity(path: string) {
    const pattern = parseWebsiteRoutePattern(path)
    if (!pattern) return null
    return pattern.parameter ? `/${pattern.segments.join('/')}/:` : path
}

export function matchWebsiteRoute<T extends { path: string }>(routes: readonly T[], path: string) {
    const actual = parseWebsiteRoutePattern(path)
    if (!actual || actual.parameter) return undefined
    const exact = routes.find(route => route.path === path)
    if (exact) return {route: exact, params: {}}
    for (const route of routes) {
        const pattern = parseWebsiteRoutePattern(route.path)
        if (!pattern?.parameter || actual.segments.length !== pattern.segments.length + 1) continue
        if (pattern.segments.every((value, index) => value === actual.segments[index])) {
            return {route, params: {[pattern.parameter]: actual.segments.at(-1)!}}
        }
    }
}
