// 将发布区块转换为场景描述，并过滤空插槽内容。
import { Comment, Fragment, Text, type VNode } from 'vue'
import type {PublicPageStructure} from '#shared/types/public/website'

export function resolvePageScenes<S extends PublicPageStructure['sections'][number], T>(sections: S[], resolveComponent: (section: S) => T | undefined) {
  const ids = new Set<string>()
  return sections.map(section => {
    const component = resolveComponent(section)
    if (!component || ids.has(section.id)) throw new Error('Unsupported or duplicate page section')
    ids.add(section.id)
    return {...section, name: section.id, id: section.anchorKey, component}
  })
}

// 注释、v-if=false 和空白插槽都不应生成空场景。
export function hasSceneContent(nodes: VNode[]): boolean {
  return nodes.some(node => {
    if (node.type === Comment) return false
    if (node.type === Text) return String(node.children ?? '').trim().length > 0
    if (node.type === Fragment) return hasSceneContent(node.children as VNode[])
    return true
  })
}
