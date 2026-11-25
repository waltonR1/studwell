// 提取不可后台修改的结构。可编辑项仅是显示文字、约束、搜索及图片规则等显式配置。
import type {SectionField} from '../../types/website/section-template'
import type {SectionTemplateRevision} from '../../types/admin/section-template'
const editableFieldKeys=new Set(['label','searchable','required','min','max','maxDepth','imagePreset'])
function fieldStructure(field:SectionField):unknown{
 return Object.fromEntries(Object.entries(field).filter(([key])=>!editableFieldKeys.has(key)).map(([key,value])=>[key,key==='fields'?Object.fromEntries(Object.entries(value as Record<string,SectionField>).map(([name,child])=>[name,fieldStructure(child)])):key==='item'?fieldStructure(value as SectionField):value]))
}
function editorStructure(value:unknown):unknown{
 if(Array.isArray(value))return value.map(editorStructure)
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!['label','help','title','nameLabel','itemLabel','titleFallback','rows'].includes(key)).map(([key,child])=>[key,['defaults','bindings'].includes(key)?child:editorStructure(child)]))
 return value
}
export function templateConfigurationStructure(definition:SectionTemplateRevision){
 const {name:_name,category:_category,allowedPages:_allowed,fields,mediaSlots,editor,...fixed}=definition
 return {...fixed,fields:fieldStructure(fields),mediaSlots:mediaSlots.map(({imagePreset:_preset,...slot})=>slot),editor:editorStructure(editor)}
}
