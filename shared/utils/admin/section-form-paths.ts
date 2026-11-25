// 后台表单与服务端合同校验共用的字段路径解析，不依赖应用运行层。
import type {SectionField,SectionContentDefinition} from '../../types/website/section-template'
export const fieldPath=(field:{path:string;absolute?:boolean},base='')=>field.absolute||!base?field.path:`${base}.${field.path}`
export function contentField(definition:SectionContentDefinition,path:string):SectionField|undefined{
 let field:SectionField|undefined=definition.fields
 for(const key of path.split('.').filter(Boolean)){
  if(field?.kind==='group')field=field.fields[key]
  else if(field?.kind==='tree')field=key==='children'?{kind:'list',label:field.label,item:field,max:field.max}:field.fields[key]
  else if(field?.kind==='list'&&/^\d+$/.test(key))field=field.item
  else return undefined
 }
 return field
}
