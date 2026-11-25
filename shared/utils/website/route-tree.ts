// 校验路由树并投影完整路径，检查循环、深度和目标唯一性；节点类型在 types/website。
import {websiteRoutePatternIdentity} from './route-pattern'

import type {WebsiteRouteNode} from '../../types/website/route'

export function projectWebsiteRouteTree(nodes: readonly WebsiteRouteNode[]) {
    const byId = new Map(nodes.map(node => [node.id, node]))
    if (byId.size !== nodes.length) throw new Error('Duplicate route node')
    const paths = new Set<string>(), targets = new Set<string>()
    return nodes.map(node => {
        const seen = new Set<string>(), segments: string[] = []
        let current: WebsiteRouteNode | undefined = node
        while (current) {
            if (seen.has(current.id)) throw new Error('Route cycle')
            seen.add(current.id)
            if (current.slug) {
                if (current.slug.startsWith(':') && (current.id !== node.id || current.targetType !== 'page' || current.parentId === null)) throw new Error('Dynamic route must be a leaf page')
                segments.unshift(current.slug)
            } else if (current.parentId !== null || current.targetType !== 'page') throw new Error('Invalid root route')
            const parentId: string | null = current.parentId
            current = parentId === null ? undefined : byId.get(parentId)
            if (parentId !== null && !current) throw new Error('Missing route parent')
        }
        if (segments.length > 6) throw new Error('Route depth exceeds six segments')
        const path = '/' + segments.join('/')
        const pattern = websiteRoutePatternIdentity(path)
        if (!pattern) throw new Error('Reserved or invalid route path')
        if (paths.has(pattern)) throw new Error('Duplicate route path')
        paths.add(pattern)
        if (node.targetType === 'group') {
            if (node.resourceId !== null) throw new Error('Group cannot have a content target')
        } else {
            if (node.targetType !== 'page' || !node.resourceId) throw new Error('Invalid route target')
            const target = node.resourceId
            if (targets.has(target)) throw new Error('Duplicate route target')
            targets.add(target)
        }
        return {...node, enabled: node.enabled ?? true, path}
    })
}
