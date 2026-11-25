// 校验可维护配置及其结构边界，不查询数据库或修改模板。
import {isDeepStrictEqual} from 'node:util'
import {templateConfigurationStructure} from '#shared/utils/admin/template-configuration'
import {publishedFieldDefinition} from '#shared/schemas/website/section-template'
import {assertSectionFormContract} from '#shared/utils/admin/section-form-contract'
import type {SectionTemplateRevision} from '#shared/types/admin/section-template'
import type {SectionField} from '#shared/types/website/section-template'
import {ApiError} from '../core/errors'
const invalid=(message:string)=>new ApiError('INVALID_INPUT',[{path:'definition',message}])
export function assertTemplateConfiguration(next:SectionTemplateRevision,previous?:SectionTemplateRevision){
 if(next.fields.kind!=='group'&&next.fields.kind!=='tree')throw invalid('模板根字段必须是对象结构。')
 if(previous&&!isDeepStrictEqual(templateConfigurationStructure(previous),templateConfigurationStructure(next)))throw invalid('不允许修改模板代称、字段路径或类型、媒体槽位结构、组件身份及数据源。请登记新模板。')
 publishedFieldDefinition(next.fields)
 try{assertSectionFormContract(next)}catch{throw invalid('后台表单布局与字段合同不匹配，请核对字段路径、控件类型及覆盖范围。')}
 if(new Set(next.mediaSlots.map(slot=>slot.key)).size!==next.mediaSlots.length)throw invalid('媒体槽位代称不能重复。')
 if(next.allowedPages!=='all'&&new Set(next.allowedPages).size!==next.allowedPages.length)throw invalid('页面约束不能重复。')
 function check(field:SectionField){
  if(field.label.length>200||field.min!==undefined&&field.max!==undefined&&field.min>field.max)throw invalid('字段名称或上下限无效。')
  if(['list','text'].includes(field.kind)&&[field.min,field.max].some(value=>value!==undefined&&(!Number.isInteger(value)||value<0)))throw invalid('文本长度和列表数量必须为非负整数。')
  if(field.imagePreset&&(field.kind!=='media'||field.mediaKind==='video'))throw invalid('图片规则只能配置在图片字段上。')
  if(field.fields)for(const [key,child] of Object.entries(field.fields)){if(['__proto__','constructor','prototype'].includes(key))throw invalid('字段路径包含禁止的名称。');check(child)}
  if(field.item)check(field.item)
 }
 check(next.fields)
 if(next.mediaSlots.some(slot=>slot.kind==='video'&&slot.imagePreset))throw invalid('视频槽位不能配置图片规则。')
}
