// 前后端共用编辑布局与字段合同校验，首次登记也不能导入失配的表单。
import {sectionFormSchema} from '../../schemas/admin/section-form'
import type {SectionEditorTemplate} from '../../types/admin/section-template'
import type {SectionTemplate} from '../../types/website/section-template'
import type {FormField} from '../../types/admin/section-form'
import {contentField,fieldPath} from './section-form-paths'
import {sectionFormUncoveredPaths} from './section-form-coverage'
function supportsFields(definition:SectionTemplate,values:FormField[],base=''):boolean{
 return values.every(field=>{
  if(field.kind==='slot')return definition.mediaSlots.some(slot=>slot.key===field.key)
  if(field.kind==='bannerImages')return contentField(definition,field.path)?.kind==='list'&&contentField(definition,field.path+'.0.'+field.imagePath)?.kind==='media'
  const path=fieldPath(field,base),contract=contentField(definition,path)
  if(!contract)return false
  if(field.kind==='collection'){
   if(field.tree)return (contract.kind==='tree'||contract.kind==='list')&&field.tree.levels.every((level,index)=>supportsFields(definition,level.fields,(field.tree!.roots==='single'?path:path+'.0')+(index?'.'+field.tree!.childrenField+'.0':'')))
   return contract.kind==='list'&&supportsFields(definition,field.fields??[],path+'.0')&&(field.fixedRows??[]).every(row=>supportsFields(definition,row.fields,path+'.0'))
  }
  if(field.kind==='lines')return contract.kind==='list'&&contract.item.kind==='text'
  return contract.kind===(['text','textarea','pattern','select'].includes(field.kind)?'text':field.kind)
 })
}
export function assertSectionFormContract(definition:SectionEditorTemplate){
 const extension=definition.editor
 if(!extension)return
 sectionFormSchema.parse(extension)
 if(extension.key!==definition.key||!extension.groups.every(group=>supportsFields(definition,group.fields))||sectionFormUncoveredPaths(definition,extension).length)throw new Error('Template editor does not match its field contract: '+definition.key)
}
