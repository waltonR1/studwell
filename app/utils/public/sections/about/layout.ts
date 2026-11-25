// 确定性扇区布局：保留分支顺序，以节点和连线的几何间距计算所需空间。
import type { OrganizationNode } from '~/types/public/sections/about/organization'

export interface OrganizationLayoutNode<T> { id: string; children?: readonly T[] }

export interface OrganizationPoint<T extends OrganizationLayoutNode<T> = OrganizationNode> {
  node: T
  parentId?: string
  depth: number
  x: number
  y: number
  radius: number
  halfHeight?: number
}

// 点到线段距离，同时检查端点附近，避免连线从无关节点边缘擦过。
type Geometry = Pick<OrganizationPoint, 'x' | 'y' | 'radius' | 'halfHeight'>
function segmentDistance(point: Geometry, a: Geometry, b: Geometry): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  const progress = lengthSquared ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)) : 0
  return Math.hypot(point.x - a.x - progress * dx, point.y - a.y - progress * dy)
}

export function layoutOrganization<T extends OrganizationLayoutNode<T>>(root: T, expanded?: ReadonlySet<string>, mode?: 'hierarchy' | 'radial'): OrganizationPoint<T>[] {
  // 自上而下按关系自动展开，父节点位于其整棵子树的中心。
  if (mode !== 'radial') {
    const result: OrganizationPoint<T>[] = []
    const widths = new Map<T, number>(), ids = new Set<string>()
    const childrenOf = (node: T) => !expanded || expanded.has(node.id) ? node.children || [] : []
    function measure(node: T): number {
      if (ids.has(node.id)) throw new Error('Duplicate organization node: ' + node.id)
      ids.add(node.id)
      const children = childrenOf(node)
      const width = children.length ? children.reduce((sum, child) => sum + measure(child), 0) : 1
      widths.set(node, width)
      return width
    }
    const total = measure(root), step = 260, start = -(total - 1) * step / 2
    function place(node: T, depth: number, column: number, parentId?: string) {
      const width = widths.get(node)!
      result.push({ node, parentId, depth, x: start + (column + (width - 1) / 2) * step, y: depth === 0 ? 0 : 170 + (depth - 1) * 210, radius: depth === 0 ? 150 : depth === 1 ? 112 : 94, halfHeight: depth === 0 ? 40 : depth === 1 ? 36 : 88 })
      let cursor = column
      for (const child of childrenOf(node)) { place(child, depth + 1, cursor, node.id); cursor += widths.get(child)! }
    }
    place(root, 0, 0)
    return result
  }
  const points: OrganizationPoint<T>[] = []
  const ids = new Set<string>()
  const childrenOf = (node: T) => !expanded || expanded.has(node.id) ? node.children || [] : []

  function place(node: T, depth: number, start: number, end: number, parentId?: string) {
    const angle = (start + end) / 2
    if (ids.has(node.id)) throw new Error('Duplicate organization node: ' + node.id)
    ids.add(node.id)
    const distance = depth * 240
    // 公司名称与职能长文使用更大的阅读空间，职能节点仍小于公司节点。
    points.push({ node, parentId, depth, x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, radius: depth === 0 ? 62 : depth === 1 ? 58 : depth === 2 ? 82 : 72 })
    // 下级仅向父节点外侧延伸；子树较少时也不会绕回核心后方。
    const span = depth ? Math.min(end - start, Math.PI * .85) : end - start
    let cursor = angle - span / 2
    const children = childrenOf(node)
    for (const child of children) {
      const next = cursor + span / children.length
      place(child, depth + 1, cursor, next, node.id)
      cursor = next
    }
  }
  place(root, 0, -Math.PI * .93, Math.PI * 1.07)

  // 不再逐个推开节点：推移会改变分支方向，导致直连线穿过其他部门。
  // 统一扩展坐标保留原有角度与层级，并同时满足圆间距、线与圆间距。
  const byId = new Map(points.map(point => [point.node.id, point]))
  let scale = 1
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!
    for (let j = i + 1; j < points.length; j++) {
      const b = points[j]!
      scale = Math.max(scale, (a.radius + b.radius + 36) / Math.max(.001, Math.hypot(a.x - b.x, a.y - b.y)))
    }
    if (!a.parentId) continue
    const parent = byId.get(a.parentId)!
    for (const other of points) {
      if (other === a || other === parent) continue
      scale = Math.max(scale, (other.radius + 18) / Math.max(.001, segmentDistance(other, parent, a)))
    }
  }
  for (const point of points) { point.x *= scale; point.y *= scale }
  return points
}

// 正交连线先离开父节点，再沿同一层级横向分流，最后垂直接入子节点。
export function organizationLinkPath(parent: Geometry, child: Geometry): string {
  const parentBottom = parent.y + (parent.halfHeight || parent.radius) + 8
  const childTop = child.y - (child.halfHeight || child.radius) - 8
  const middle = parentBottom + (childTop - parentBottom) * .48
  return `M ${parent.x} ${parentBottom} V ${middle} H ${child.x} V ${childTop}`
}

// 线段停在圆边缘之外，为描边和选中外环保留空间。
