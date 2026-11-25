// 可替换的组织树：节点身份、名称与隶属关系独立于视觉坐标。
import type { LocalizedContent } from '../../runtime/content'
export interface OrganizationNode {
  id: string
  name: string | LocalizedContent<string>
  description?: string | LocalizedContent<string>
  children?: readonly OrganizationNode[]
}
