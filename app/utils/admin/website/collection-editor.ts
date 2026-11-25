import {sectionContentSchema} from '#shared/schemas/website/section-content'
import {siteLocales,type SiteLocale} from '#shared/schemas/admin/site-settings'

import {emptySectionContent} from '#shared/utils/website/page-layouts'
import type {SectionContentDefinition} from '#shared/types/website/section-template'
import type {CollectionField,FormField,ValueField} from '~/types/admin/website-section-forms'
import type {LocalizedSections} from '~/types/admin/website-section-editors'
import {assignAt,changeFormList,collectionRows,collectionStructureError,contentField,fieldPath,sectionFormLinkErrors,valueAt} from './section-forms'

type Item=Record<string,unknown>
type TreeField=NonNullable<CollectionField['tree']>
export interface CollectionEditorRow {
 key:string
 title:string
 base:string
 index:number
 depth:number
 parent:string|null
 level:number
 itemLabel:string
 identity?:string
 item:Item
 fields:FormField[]
}
export interface CollectionEdit {
 source:string
 localized:LocalizedSections
 locale:SiteLocale
 key:string
 parent:string|null
 originalParent:string|null
 mode:'add'|'edit'
}
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T
const object=(value:unknown):Item=>value&&typeof value==='object'&&!Array.isArray(value)?value as Item:{}
const levelAt=(tree:TreeField,depth:number)=>tree.levels[Math.min(depth,tree.levels.length-1)]!
const titleAt=(item:Item,index:number,level:TreeField['levels'][number])=>{
 const paths=[level.titlePath,level.titleFallback].filter((path):path is string=>!!path)
 return String(paths.map(path=>valueAt(item,path)).find(value=>typeof value==='string'&&value.trim())??'')||`${level.itemLabel} ${index+1}`
}
function treeRoots(localized:LocalizedSections,locale:SiteLocale,field:CollectionField,tree:TreeField):unknown[]{
 const value=valueAt(localized[locale],field.path)
 if(tree.roots==='multiple')return Array.isArray(value)?value:[]
 if(value===undefined||value===null)return []
 if(typeof value!=='object'||Array.isArray(value))throw new Error('单根树的数据结构不正确。')
 const root=object(value),level=levelAt(tree,0)
 if(level.identity&&!valueAt(root,level.identity)){
  const children=root[tree.childrenField]
  const hasTitle=[level.titlePath,level.titleFallback].some(path=>path&&String(valueAt(root,path)??'').trim())
  if(Array.isArray(children)&&children.length||hasTitle)throw new Error('节点标识缺失，请先修复原有内容。')
  return []
 }
 return [value]
}

// Flatten relationships only for the table; keep the frontend's saved data format.
export function collectionEditorRows(localized:LocalizedSections,locale:SiteLocale,field:CollectionField):CollectionEditorRow[]{
 if(!field.tree){
  const title=(item:Item,index:number)=>String(field.titlePath?valueAt(item,field.titlePath)??'':'')||`${field.itemLabel} ${index+1}`
  const items=collectionRows(localized,locale,field.path)
  const row=(item:unknown,index:number,fields:FormField[],label?:string):CollectionEditorRow=>({
   key:field.identity?String(valueAt(item,field.identity)??''):String(index),
   title:label??title(object(item),index),base:`${field.path}.${index}`,index,depth:0,parent:null,level:0,itemLabel:field.itemLabel,identity:field.identity,item:object(item),fields,
  })
  if(field.fixedRows)return field.fixedRows.flatMap(fixed=>{
   const index=items.findIndex(item=>valueAt(item,field.identity!)===fixed.key)
   return index<0?[]:[row(items[index],index,fixed.fields,fixed.label)]
  })
  return items.map((item,index)=>row(item,index,field.fields??[]))
 }

 const tree=field.tree,result:CollectionEditorRow[]=[],ids=new Set<string>()
 const roots=treeRoots(localized,locale,field,tree)
 const pending=roots.map((item,index)=>({item:object(item),base:tree.roots==='single'?field.path:`${field.path}.${index}`,index,depth:0,parent:null as string|null}))
 pending.reverse()
 while(pending.length){
  const current=pending.pop()!,level=levelAt(tree,current.depth),key=level.identity?String(valueAt(current.item,level.identity)??''):current.base
  if(tree.maxDepth!==undefined&&current.depth>tree.maxDepth)throw new Error('节点超过允许的最大层级。')
  if(!key||ids.has(key)||result.length>=2000||current.depth>128)throw new Error('节点关系重复、标识缺失或已超出内容上限。')
  const children=current.item[tree.childrenField]
  if(tree.maxDepth!==undefined&&current.depth>=tree.maxDepth&&Array.isArray(children)&&children.length)throw new Error('节点超过允许的最大层级。')
  ids.add(key)
  result.push({...current,key,title:titleAt(current.item,current.index,level),level:current.depth,itemLabel:level.itemLabel,identity:level.identity,fields:level.fields})
  if(Array.isArray(children))for(let index=children.length-1;index>=0;index--)pending.push({item:object(children[index]),base:`${current.base}.${tree.childrenField}.${index}`,index,depth:current.depth+1,parent:key})
 }
 return result
}

export function collectionEditorStructureError(localized:LocalizedSections,field:CollectionField):string{
 if(!field.tree)return collectionStructureError(localized,field.path,field.identity)
 try{
  const signatures=siteLocales.map(locale=>JSON.stringify(collectionEditorRows(localized,locale,field).map(row=>[row.key,row.parent,row.index,row.level])))
  return signatures.some(value=>value!==signatures[0])?'各语言的节点关系不一致，暂不能新增、删除、排序或调整上级；原有文字仍可维护。':''
 }catch(cause){return cause instanceof Error?cause.message:'节点关系无法读取。'}
}
function requireStructure(localized:LocalizedSections,field:CollectionField){
 const error=collectionEditorStructureError(localized,field)
 if(error)throw new Error(error)
}
function findRow(localized:LocalizedSections,locale:SiteLocale,field:CollectionField,key:string){
 const row=collectionEditorRows(localized,locale,field).find(row=>row.key===key)
 if(!row)throw new Error('条目已发生变化，请关闭弹窗后重新打开。')
 return row
}
function validateContent(localized:LocalizedSections,definition:SectionContentDefinition){
 const schema=sectionContentSchema(definition.fields)
 for(const locale of siteLocales)if(!schema.safeParse(localized[locale]).success)throw new Error('条目内容不符合字段要求，请检查输入和层级上限。')
}

export function beginCollectionEdit(localized:LocalizedSections,locale:SiteLocale,definition:SectionContentDefinition,field:CollectionField,key:string|null,parent:string|null=null):CollectionEdit{
 const source=JSON.stringify(localized)
 if(key!==null){
  const row=findRow(localized,locale,field,key)
  return {source,localized:clone(localized),locale,key,parent:row.parent,originalParent:row.parent,mode:'edit'}
 }
 requireStructure(localized,field)
 if(field.fixedRows)throw new Error('固定条目不能新增。')
 let next=clone(localized)
 if(!field.tree){
  next=changeFormList(next,locale,definition,field,'',-1,'add')
  const row=collectionEditorRows(next,locale,field).at(-1)!
  return {source,localized:next,locale,key:row.key,parent:null,originalParent:null,mode:'add'}
 }

 const tree=field.tree,rows=collectionEditorRows(next,locale,field)
 if(rows.length>=2000)throw new Error('已达到节点数量上限。')
 const parentKey=parent??(tree.roots==='single'&&rows.length?rows[0]!.key:null)
 const parentRow=parentKey?findRow(next,locale,field,parentKey):undefined
 const depth=parentRow?parentRow.depth+1:0
 if(tree.maxDepth!==undefined&&depth>tree.maxDepth)throw new Error('已达到允许的最大层级。')
 const level=levelAt(tree,depth)
 const contractPath=parentRow?`${parentRow.base}.${tree.childrenField}.0`:tree.roots==='single'?field.path:`${field.path}.0`
 const contract=contentField(definition,contractPath)
 if(!contract||contract.kind!=='group'&&contract.kind!=='tree')throw new Error('当前层级没有可维护的字段合同。')
 const id=`entry-${crypto.randomUUID()}`
 for(const language of siteLocales){
  const item=object(emptySectionContent(contract))
  Object.assign(item,clone(field.defaults??{}))
  if(level.identity)assignAt(item,level.identity,id)
  if(parentKey===null){
   if(tree.roots==='single')assignAt(next[language],field.path,item)
   else{
    const items=valueAt(next[language],field.path)
    if(Array.isArray(items))items.push(item)
    else assignAt(next[language],field.path,[item])
   }
  }else{
   const owner=findRow(next,language,field,parentKey).item
   if(!Array.isArray(owner[tree.childrenField]))owner[tree.childrenField]=[]
   ;(owner[tree.childrenField] as unknown[]).push(item)
  }
 }
 const createdKey=level.identity?id:collectionEditorRows(next,locale,field).find(row=>!rows.some(previous=>previous.key===row.key))!.key
 return {source,localized:next,locale,key:createdKey,parent:parentKey,originalParent:parentKey,mode:'add'}
}

export function collectionParentOptions(edit:CollectionEdit,field:CollectionField):Array<{value:string;label:string}>{
 const tree=field.tree
 if(!tree||!tree.allowReparent)return []
 const rows=collectionEditorRows(edit.localized,edit.locale,field),current=rows.find(row=>row.key===edit.key)
 return rows.filter(row=>row.key!==edit.key&&!row.base.startsWith(current!.base+'.')&&(tree.maxDepth===undefined||row.depth<tree.maxDepth)).map(row=>({value:row.key,label:`${row.title}（第 ${row.depth+1} 层）`}))
}

export function finishCollectionEdit(current:LocalizedSections,edit:CollectionEdit,definition:SectionContentDefinition,field:CollectionField):LocalizedSections{
 if(JSON.stringify(current)!==edit.source)throw new Error('页面内容已变化，请关闭弹窗后重新编辑。')
 const next=clone(edit.localized),row=findRow(next,edit.locale,field,edit.key),tree=field.tree
 const level=tree?levelAt(tree,row.depth):undefined
 const requiredTitle=level?.titlePath??field.titlePath,fallbackTitle=level?.titleFallback
 const title=String(requiredTitle?valueAt(row.item,requiredTitle)??'':'').trim()||String(fallbackTitle?valueAt(row.item,fallbackTitle)??'':'').trim()
 if(requiredTitle&&!title)throw new Error(`请填写${level?.itemLabel??field.itemLabel}名称。`)
 if(tree&&edit.parent!==edit.originalParent){
  requireStructure(next,field)
  if(!tree.allowReparent)throw new Error('当前结构不允许更换上级。')
  if(row.parent===null||edit.parent===null)throw new Error('请保留现有顶层节点，并选择有效上级。')
  if(!collectionParentOptions(edit,field).some(option=>option.value===edit.parent))throw new Error('不能选择自身或下级作为上级。')
  for(const language of siteLocales){
   const moving=findRow(next,language,field,edit.key),owner=findRow(next,language,field,moving.parent!)
   const destination=findRow(next,language,field,edit.parent).item
   const [item]=(owner.item[tree.childrenField] as unknown[]).splice(moving.index,1)
   if(!Array.isArray(destination[tree.childrenField]))destination[tree.childrenField]=[]
   ;(destination[tree.childrenField] as unknown[]).push(item)
  }
 }
 const updated=findRow(next,edit.locale,field,edit.key)
 const resolved=updated.fields.map(field=>('path' in field&&field.kind!=='collection'?{...field,path:fieldPath(field,updated.base),absolute:true}:field))
 const linkErrors=sectionFormLinkErrors(next,{key:'entry',groups:[{title:'entry',fields:resolved}]})
 if(linkErrors.length)throw new Error(linkErrors.join(' '))
 validateContent(next,definition)
 return next
}

export function moveCollectionRow(localized:LocalizedSections,locale:SiteLocale,definition:SectionContentDefinition,field:CollectionField,key:string,direction:'up'|'down'):LocalizedSections{
 requireStructure(localized,field)
 const row=findRow(localized,locale,field,key),tree=field.tree
 if(!tree)return changeFormList(localized,locale,definition,field,'',row.index,direction)
 if(row.parent===null&&tree.roots==='single')throw new Error('顶层节点没有同级排序。')
 const next=clone(localized),delta=direction==='up'?-1:1
 for(const language of siteLocales){
  const current=findRow(next,language,field,key)
  const items=(current.parent===null?valueAt(next[language],field.path):findRow(next,language,field,current.parent).item[tree.childrenField]) as unknown[]|undefined
  if(!Array.isArray(items))throw new Error('节点关系无法排序。')
  const index=current.index+delta
  if(index<0||index>=items.length)throw new Error('已到达同级排序边界。')
  items.splice(index,0,items.splice(current.index,1)[0])
 }
 return next
}

export function removeCollectionRow(localized:LocalizedSections,locale:SiteLocale,definition:SectionContentDefinition,field:CollectionField,key:string):LocalizedSections{
 requireStructure(localized,field)
 const row=findRow(localized,locale,field,key),tree=field.tree
 if(!tree)return changeFormList(localized,locale,definition,field,'',row.index,'remove')
 const next=clone(localized)
 for(const language of siteLocales){
  const current=findRow(next,language,field,key)
  if(current.parent===null){
   if(tree.roots==='single')assignAt(next[language],field.path,emptySectionContent(contentField(definition,field.path)!))
   else{
    const items=valueAt(next[language],field.path)
    if(Array.isArray(items))items.splice(current.index,1)
   }
  }else{
   const parent=findRow(next,language,field,current.parent)
   const items=parent.item[tree.childrenField]
   if(Array.isArray(items))items.splice(current.index,1)
  }
 }
 return next
}

export function collectionColumnField(row:CollectionEditorRow,key:string):ValueField|undefined{
 return row.fields.find((field):field is ValueField=>field.kind!=='collection'&&field.kind!=='bannerImages'&&'path'in field&&(field.key??field.path)===key)
}
