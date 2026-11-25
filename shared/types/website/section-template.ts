// 区块公共字段、图片槽位及装配约束；后台编辑布局和预览元数据位于 types/admin。
import type {ImageRule} from '../image-presentation'

interface SectionFieldOptions {
    label: string
    // 文本字段默认参与搜索；false 排除当前字段及其整个子树。
    searchable?: boolean
    mediaKind?: 'image' | 'video'
    imagePreset?: ImageRule
    max?: number
    min?: number
    maxDepth?: number
    required?: boolean
    optional?: boolean
    fields?: Record<string, SectionField>
    item?: SectionField
}

export type SectionField = SectionFieldOptions & (
    { kind: 'group'; fields: Record<string, SectionField> } |
    { kind: 'tree'; fields: Record<string, SectionField> } |
    { kind: 'list'; item: SectionField } |
    { kind: 'text' | 'number' | 'media' | 'boolean' | 'link' }
    )

export interface SectionContentDefinition {
    fields: SectionField
    mediaSlots: Array<{ key: string; name: string; kind: 'image' | 'video'; imagePreset?: ImageRule }>
}

export interface SectionTemplate extends SectionContentDefinition {
    banner?: {
        family: string
        videoPath?: string
        stripPaths?: string[]
        referenceDefaults?: Record<string, string>
    }
    key: string
    name: string
    allowedPages: 'all' | string[]
    dataSource: 'news' | null
}
