import {contentField,fieldPath} from '#shared/utils/admin/section-form-paths'
export {contentField,fieldPath} from '#shared/utils/admin/section-form-paths'
import {linkTargetSchema} from '#shared/schemas/website/link-target'
import {siteLocales,type SiteLocale} from '#shared/schemas/admin/site-settings'
import {emptySectionContent} from '#shared/utils/website/page-layouts'
import type {SectionContentDefinition} from '#shared/types/website/section-template'
import type {LocalizedSections} from '~/types/admin/website-section-editors'
import type {FormField,ValueField,CollectionField,SectionFormDefinition,ListAction} from '~/types/admin/website-section-forms'

type ContentObject=Record<string,unknown>
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T
export function valueAt(root:unknown,path:string):unknown{
 return path.split('.').filter(Boolean).reduce<unknown>((value,key)=>value&&typeof value==='object'?(value as ContentObject)[key]:undefined,root)
}
export function assignAt(root:unknown,path:string,value:unknown,remove=false){
 const keys=path.split('.').filter(Boolean)
 let object=root as ContentObject
 keys.slice(0,-1).forEach((key,index)=>{
  if(!object[key]||typeof object[key]!=='object')object[key]=/^\d+$/.test(keys[index+1]!)?[]:{}
  object=object[key] as ContentObject
 })
 const key=keys.at(-1)!
 if(remove)delete object[key]
 else object[key]=value
}
export function collectionRows(localized:LocalizedSections,locale:SiteLocale,path:string):unknown[]{
 const rows=valueAt(localized[locale],path)
 return Array.isArray(rows)?rows:[]
}
export function collectionStructureError(localized:LocalizedSections,path:string,identity?:string):string{
 const signatures=siteLocales.map(locale=>{
  const parentIds=identity?path.split('.').flatMap((key,index,keys)=>/^\d+$/.test(key)?[valueAt(localized[locale],keys.slice(0,index+1).join('.')+'.'+identity)]:[]):[]
  const rows=collectionRows(localized,locale,path)
  if(!identity)return String(rows.length)
  const ids=rows.map(row=>String(valueAt(row,identity)??''))
  return new Set(ids).size===ids.length?JSON.stringify([parentIds,ids]):null
 })
 return signatures.some(value=>value===null||value!==signatures[0])?'各语言的条目结构不一致，暂不能同步增删或排序；原内容仍可维护。':''
}
export function initializeSectionForm(localized:LocalizedSections,config:SectionFormDefinition,definition:SectionContentDefinition):LocalizedSections{
 const next=clone(localized)
 for(const locale of siteLocales){
  if(next[locale]===undefined)next[locale]=emptySectionContent(definition.fields)
  for(const group of config.groups)for(const field of group.fields){
   if(field.kind==='pattern'&&!valueAt(next[locale],field.path))assignAt(next[locale],field.path,`{${field.token??'count'}}`)
   if(field.kind!=='collection'||!field.fixedRows||!field.identity)continue
   const contract=contentField(definition,field.path)
   if(contract?.kind!=='list')continue
   const rows=collectionRows(next,locale,field.path)
   for(const fixed of field.fixedRows){
    let item=rows.find(row=>valueAt(row,field.identity!)===fixed.key) as ContentObject|undefined
    if(!item){
    item=emptySectionContent(contract.item) as ContentObject
    assignAt(item,field.identity,fixed.key)
    Object.assign(item,clone(field.defaults??{}))
    for(const [path,value] of Object.entries(fixed.bindings??{}))assignAt(item,path,value)
    rows.push(item)
    }
   }
   assignAt(next[locale],field.path,rows)
  }
 }
 return next
}
export function changeFormValue(localized:LocalizedSections,locale:SiteLocale,field:ValueField,base:string,value:unknown,identity?:string):LocalizedSections{
 const next=clone(localized),path=fieldPath(field,base)
 if(field.kind==='number'){
  const number=Number(value)
  if(!Number.isFinite(number))throw new Error('请输入有效数值。')
  if(field.integer&&!Number.isInteger(number))throw new Error('请输入整数。')
  if(field.min!==undefined&&number<field.min)throw new Error(`请输入不小于 ${field.min} 的数值。`)
  if(field.max!==undefined&&number>field.max)throw new Error(`请输入不大于 ${field.max} 的数值。`)
 }
 if(field.shared&&base){
  const listPath=base.split('.').slice(0,-1).join('.')
  const error=collectionStructureError(localized,listPath,identity)
  if(error)throw new Error(error)
 }
 for(const language of field.shared?siteLocales:[locale]){
  assignAt(next[language],path,field.kind==='number'?Number(value):value,!!field.optional&&(value===''||value===undefined))
  if(field.deriveTelephone){const parent=path.split('.').slice(0,-1).join('.');assignAt(next[language],`${parent}.href`,'tel:'+String(value??'').replace(/[^\d+]/g,''))}
  if(field.exclusive&&value===field.exclusive.value&&base){
   const parts=base.split('.'),index=Number(parts.pop()),listPath=parts.join('.')
   collectionRows(next,language,listPath).forEach((row,i)=>{if(i!==index&&valueAt(row,field.path)===value)assignAt(row,field.path,field.exclusive!.replacement)})
  }
 }
 return next
}
export function changeFormList(localized:LocalizedSections,locale:SiteLocale,definition:SectionContentDefinition,field:CollectionField|ValueField,base:string,index:number,action:ListAction):LocalizedSections{
 if(field.kind==='collection'&&field.fixedRows)throw new Error('固定条目不能增删或排序。')
 const path=fieldPath(field,base),shared=field.kind==='collection'
 if(shared){const error=collectionStructureError(localized,path,field.identity);if(error)throw new Error(error)}
 const contract=contentField(definition,path)
 if(contract?.kind!=='list')throw new Error('当前条目不可维护。')
 const current=collectionRows(localized,locale,path)
 if(action==='add'&&current.length>=(contract.max??100))throw new Error('已达到当前条目数量上限。')
 if(action!=='add'&&(index<0||index>=current.length))throw new Error('该条目已移除。')
 const target=index+(action==='up'?-1:1)
 if((action==='up'||action==='down')&&(target<0||target>=current.length))return localized
 const next=clone(localized),id=`entry-${crypto.randomUUID()}`
 for(const language of shared?siteLocales:[locale]){
  const rows=collectionRows(next,language,path)
  if(action==='add'){
   const item=emptySectionContent(contract.item)
   if(shared&&item&&typeof item==='object'){
    Object.assign(item,clone(field.defaults??{}))
    if(field.identity)assignAt(item,field.identity,id)
   }
   rows.push(item)
  }else if(action==='remove')rows.splice(index,1)
  else rows.splice(target,0,rows.splice(index,1)[0])
  assignAt(next[language],path,rows)
 }
 return next
}
export function managedFormMedia(config?:SectionFormDefinition):Set<string>{
 const keys=new Set<string>()
 function visit(fields:FormField[]){for(const field of fields){if(field.kind==='slot')keys.add(field.key);if(field.kind==='collection'){visit(field.fields??[]);field.tree?.levels.forEach(level=>visit(level.fields));field.fixedRows?.forEach(row=>visit(row.fields))}}}
 config?.groups.forEach(group=>visit(group.fields))
 return keys
}

// Validate draft links after updating them, so operators can type a URL character by character.
export function sectionFormLinkErrors(localized:LocalizedSections,config:SectionFormDefinition):string[]{
 const errors=new Set<string>()
 function visit(fields:FormField[],locale:SiteLocale,base=''){
  for(const field of fields){
   if(field.kind==='collection'){
    const path=fieldPath(field,base),rows=collectionRows(localized,locale,path)
    if(field.tree){
     const roots=field.tree.roots==='single'?[valueAt(localized[locale],path)].filter(value=>value&&typeof value==='object'):rows
     const pending=roots.map((root,index)=>({node:root as Record<string,unknown>,depth:0,base:field.tree!.roots==='single'?path:`${path}.${index}`}))
     while(pending.length){
      const current=pending.pop()!,level=field.tree.levels[Math.min(current.depth,field.tree.levels.length-1)]!
      visit(level.fields,locale,current.base)
      const children=current.node[field.tree.childrenField]
      if(Array.isArray(children))for(let index=children.length-1;index>=0;index--)pending.push({node:children[index] as Record<string,unknown>,depth:current.depth+1,base:`${current.base}.${field.tree.childrenField}.${index}`})
     }
    }else rows.forEach((row,index)=>visit(field.fixedRows?.find(fixed=>valueAt(row,field.identity!)===fixed.key)?.fields??field.fields??[],locale,`${path}.${index}`))
   }else if(field.kind==='link'){
    const value=valueAt(localized[locale],fieldPath(field,base))
    if(value&&!linkTargetSchema.safeParse(value).success)errors.add(`${field.label}：请填写站内路径或有效链接。`)
   }
  }
 }
 for(const locale of siteLocales)for(const group of config.groups)visit(group.fields,locale)
 return [...errors]
}
