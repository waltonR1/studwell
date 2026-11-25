// 按发布组件路径异步加载区块，并缓存组件定义。
import {defineAsyncComponent, type Component} from 'vue'

const loaders = import.meta.glob<{default: Component}>('../../../components/public/sections/**/*.vue')
const renderers = new Map<string, Component>()

export function resolveSectionRenderer(path: string) {
  if (!path.startsWith('app/components/public/sections/')) throw new Error(`Invalid public section path: ${path}`)
  const cached = renderers.get(path)
  if (cached) return cached
  const entry = '../../../' + path.slice('app/'.length)
  const loader = Object.hasOwn(loaders, entry) ? loaders[entry] : undefined
  if (!loader) throw new Error(`Unregistered public section renderer: ${path}`)
  const component = defineAsyncComponent(async () => (await loader()).default)
  renderers.set(path, component)
  return component
}
