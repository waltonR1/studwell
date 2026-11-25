import type {SectionTemplateRevision} from '#shared/types/admin/section-template'
// 编辑窗口状态；完整定义只在首次登记导入，已有模板从数据库克隆。
export interface TemplateConfigurationDraft {
 id:string|null
 version:number
 revision:number
 definition:SectionTemplateRevision|null
 publicComponentPath:string
 previewComponentPath:string
 description:string
}
