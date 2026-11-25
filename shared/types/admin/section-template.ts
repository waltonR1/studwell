// 后台模板修订在公共字段合同上组合编辑布局、预览样例与组件映射。
import type {SectionTemplate} from '../website/section-template'
import type {SectionFormDefinition} from './section-form'

export interface SectionEditorTemplate extends SectionTemplate {
    editor?: SectionFormDefinition | null
}

export interface SectionTemplateRevision extends SectionTemplate {
    category?: string
    editor: SectionFormDefinition | null
    preview: { pageKey: string }
    publicRendererId: string
    previewRendererId: string
}
