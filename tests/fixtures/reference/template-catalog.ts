// 固定回归合同快照，不参与本站初始化或公开内容。
import data from './template-catalog.json'
import {sectionTemplateRevisionSchema} from '../../../shared/schemas/admin/section-template'
export const websiteTemplateCatalog=data.map(item=>sectionTemplateRevisionSchema.parse(item))
export const templateDefinition=(key:string)=>websiteTemplateCatalog.find(template=>template.key===key)

import samples from './template-samples.json'
import type {WebsiteTemplateSample} from '#shared/types/admin/website-preview'
export const websiteTemplateSamples=samples as unknown as Record<string,WebsiteTemplateSample>
