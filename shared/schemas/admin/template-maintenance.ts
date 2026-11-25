// 后台模板登记与修订输入；首次导入完整合同，后续结构不变规则由服务端复核。
import {z} from 'zod'
import {entityVersionSchema} from '../entity'
import {sectionTemplateRevisionSchema} from './section-template'
const componentPath=z.string().trim().min(1).max(500)
export const templateRegistrationSchema=z.strictObject({
 definition:sectionTemplateRevisionSchema,
 publicComponentPath:componentPath,
 previewComponentPath:componentPath,
 description:z.string().max(1000).default(''),
})
export const templateRevisionUpdateSchema=z.strictObject({
 version:entityVersionSchema,
 revision:entityVersionSchema,
 definition:sectionTemplateRevisionSchema,
})
export const sectionTemplateUpgradeSchema=z.strictObject({contentVersion:entityVersionSchema,structureVersion:entityVersionSchema,revision:entityVersionSchema})
