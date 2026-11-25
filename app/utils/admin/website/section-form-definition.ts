import {assertSectionFormContract} from '#shared/utils/admin/section-form-contract'
import type {SectionEditorTemplate} from '#shared/types/admin/section-template'
// 按数据库字段合同生成通用编辑界面；模板专用扩展只影响界面组织。
import type {SectionField,SectionTemplate} from '#shared/types/website/section-template'
import type {FormField,CollectionField,SectionFormDefinition} from '~/types/admin/website-section-forms'
function fields(field:SectionField,path:string):FormField[]{
 const base={label:field.label,path,optional:field.optional}
 if(field.kind==='group')return Object.entries(field.fields).flatMap(([key,child])=>fields(child,path?path+'.'+key:key))
 if(field.kind==='tree'||field.kind==='list'&&field.item.kind==='tree'){
  const node=(field.kind==='tree'?field:field.item) as Extract<SectionField,{kind:'tree'}>
  const identity=node.fields.id?.kind==='text'?'id':undefined
  const nodeFields=fields({kind:'group',label:node.label,fields:Object.fromEntries(Object.entries(node.fields).filter(([key])=>key!==identity))},'')
  return [{...base,kind:'collection',presentation:'table',identity,itemLabel:node.label,fields:nodeFields,
   columns:Object.entries(node.fields).filter(([key,value])=>key!==identity&&value.kind==='text').slice(0,3).map(([key,value])=>({label:value.label,field:key})),
   tree:{roots:field.kind==='tree'?'single':'multiple',childrenField:'children',allowReparent:!!identity,maxDepth:node.maxDepth,levels:[{identity,itemLabel:node.label,fields:nodeFields}]},
  } satisfies CollectionField]
 }
 if(field.kind==='list'){
  if(field.item.kind==='text')return [{...base,kind:'lines'}]
  const identity=field.item.kind==='group'&&field.item.fields.id?.kind==='text'?'id':undefined
  const itemFields=fields(field.item.kind==='group'&&identity?{...field.item,fields:Object.fromEntries(Object.entries(field.item.fields).filter(([key])=>key!==identity))}:field.item,'')
  return [{...base,kind:'collection',itemLabel:field.item.label,identity,fields:itemFields}]
 }
 if(field.kind==='text')return [{...base,kind:field.max&&field.max<=200?'text':'textarea',max:field.max}]
 if(field.kind==='number')return [{...base,kind:'number',min:field.min,max:field.max}]
 if(field.kind==='media')return [{...base,kind:'media',mediaKind:field.mediaKind??'image'}]
 return [{...base,kind:field.kind}]
}
export function createSectionForm(definition:SectionTemplate):SectionFormDefinition{
 return {key:definition.key,groups:[{title:definition.name,fields:fields(definition.fields,'')}]}
}
// 同一数据库修订中的编辑布局必须匹配字段合同，失配直接报告数据错误。
export function resolveSectionForm(definition:SectionEditorTemplate){
 const extension=definition.editor
 if(!extension)return createSectionForm(definition)
 assertSectionFormContract(definition)
 return extension
}
