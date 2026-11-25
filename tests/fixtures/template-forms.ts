// 测试复用初始入库数据，不再引用前端专用配置。
import {websiteTemplateCatalog} from './reference/template-catalog'
import type {SectionFormDefinition} from '../../shared/types/admin/section-form'
export const sectionForms=Object.fromEntries(websiteTemplateCatalog.filter(template=>template.editor).map(template=>[template.key,template.editor!])) as Record<string,SectionFormDefinition>
