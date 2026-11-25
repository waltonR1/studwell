// 对照实际字段合同检查编辑覆盖，新增字段不能因已有界面扩展而隐藏。
import type {SectionField,SectionTemplate} from '#shared/types/website/section-template'
import type {FormField,SectionFormDefinition} from '#shared/types/admin/section-form'
import {contentField,fieldPath} from './section-form-paths'
export function sectionFormUncoveredPaths(definition:SectionTemplate,config:SectionFormDefinition):string[]{
 const covered=new Set<string>()
 const normalize=(path:string)=>path.split('.').filter(Boolean).join('.')
 const add=(path:string)=>covered.add(normalize(path))
 function value(path:string,defaults:unknown){
  const field=contentField(definition,path)
  if(field?.kind==='group'&&defaults&&typeof defaults==='object')for(const [key,child] of Object.entries(defaults))value(path+'.'+key,child)
  else add(path)
 }
 function visit(fields:FormField[],base=''){
  for(const field of fields){
   if(field.kind==='slot')continue
   if(field.kind==='bannerImages'){
    const item=field.path+'.0'
    add(item+'.'+field.identityPath);add(item+'.'+field.imagePath)
    for(const [key,entry] of Object.entries(field.defaults))value(item+'.'+key,entry)
    if(field.videoPath)add(field.videoPath)
    continue
   }
   const path=fieldPath(field,base)
   if(field.kind==='collection'){
    const item=field.tree?.roots==='single'?path:path+'.0'
    if(field.identity)add(item+'.'+field.identity)
    for(const [key,entry] of Object.entries(field.defaults??{}))value(item+'.'+key,entry)
    visit(field.fields??[],item)
    for(const row of field.fixedRows??[]){visit(row.fields,item);for(const [key,entry] of Object.entries(row.bindings??{}))value(item+'.'+key,entry)}
    for(const [index,level] of (field.tree?.levels??[]).entries()){
     const node=item+(index?'.'+field.tree!.childrenField+'.0':'')
     if(level.identity)add(node+'.'+level.identity)
     visit(level.fields,node)
    }
   }else{
    add(field.kind==='lines'?path+'.0':path)
    if(field.deriveTelephone)add(path.split('.').slice(0,-1).concat('href').join('.'))
   }
  }
 }
 for(const group of config.groups)visit(group.fields)
 for(const path of config.readOnlyPaths??[])if(contentField(definition,path))add(path)
 const missing:string[]=[]
 function contract(field:SectionField,path=''){
  if(field.kind==='group'||field.kind==='tree')for(const [key,child] of Object.entries(field.fields))contract(child,path?path+'.'+key:key)
  else if(field.kind==='list')contract(field.item,path+'.0')
  else if(!covered.has(normalize(path)))missing.push(path)
 }
 contract(definition.fields)
 return missing
}
