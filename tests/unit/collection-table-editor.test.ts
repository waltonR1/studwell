import {expect,it} from 'vitest'
import {siteLocales} from '../../shared/schemas/admin/site-settings'
import {templateDefinition} from '../fixtures/reference/template-catalog'
import {sectionForms} from '../fixtures/template-forms'
import {beginCollectionEdit,collectionColumnField,collectionEditorRows,finishCollectionEdit,moveCollectionRow,removeCollectionRow} from '../../app/utils/admin/website/collection-editor'
import {changeFormValue,fieldPath,valueAt} from '../../app/utils/admin/website/section-forms'
import type {CollectionField,ValueField} from '../../app/types/admin/website-section-forms'
import type {LocalizedSections} from '../../app/types/admin/website-section-editors'
import fixture from '../fixtures/website-content.json'

function source(key:string):LocalizedSections{
 const data=structuredClone(fixture.pages.flatMap(page=>page.sections).find(section=>section.templateKey===key)!.localized)
 const normalize=(value:unknown):unknown=>Array.isArray(value)?value.map(normalize):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,key==='mediaId'&&item?'2026110214000000001':normalize(item)])):value
 return normalize(data) as LocalizedSections
}
const collection=(key:string)=>sectionForms[key]!.groups.flatMap(group=>group.fields).find((field):field is CollectionField=>field.kind==='collection')!

it('图片表格沿用配置的图片和位置字段，编辑临时副本不会提前写入草稿',()=>{
 const key='home.about',field=collection(key),definition=templateDefinition(key)!,data=source(key),before=structuredClone(data)
 expect(field.presentation).toBe('table')
 const row=collectionEditorRows(data,'zh',field)[0]!
 expect(field.columns!.map(column=>collectionColumnField(row,column.field)?.kind)).toEqual(['media','select','boolean'])
 expect(collectionColumnField(row,'mobileSlideshow')).toMatchObject({kind:'boolean',defaultChecked:true})
 const edit=beginCollectionEdit(data,'zh',definition,field,row.key)
 const image=collectionColumnField(row,'image')!
 edit.localized=changeFormValue(edit.localized,'zh',image,row.base,{mediaId:'2026110214000000002'})
 expect(data).toEqual(before)
 const saved=finishCollectionEdit(data,edit,definition,field)
 expect(valueAt(saved.zh,fieldPath(image,row.base))).toEqual({mediaId:'2026110214000000002'})
 expect(saved.en).toEqual(data.en)
})

it('图片新增确认前不会占据列表，确认后同步条目数量并允许排序和删除',()=>{
 const key='home.about',field=collection(key),definition=templateDefinition(key)!,data=source(key)
 const initial=collectionEditorRows(data,'zh',field)
 const edit=beginCollectionEdit(data,'zh',definition,field,null)
 expect(collectionEditorRows(data,'zh',field)).toHaveLength(initial.length)
 let saved=finishCollectionEdit(data,edit,definition,field)
 for(const locale of siteLocales)expect(collectionEditorRows(saved,locale,field)).toHaveLength(initial.length+1)
 saved=moveCollectionRow(saved,'zh',definition,field,edit.key,'up')
 saved=removeCollectionRow(saved,'zh',definition,field,String(initial.length-1))
 expect(saved).toEqual(data)
})

it('图片主图位置在弹窗内隔离，确认后才同步位置并保留唯一主图约束',()=>{
 const key='home.about',field=collection(key),definition=templateDefinition(key)!,data=source(key),before=structuredClone(data)
 const row=collectionEditorRows(data,'zh',field)[1]!
 const edit=beginCollectionEdit(data,'zh',definition,field,row.key),position=collectionColumnField(row,'position')!
 edit.localized=changeFormValue(edit.localized,'zh',position,row.base,'featured')
 expect(data).toEqual(before)
 const saved=finishCollectionEdit(data,edit,definition,field)
 for(const locale of siteLocales){
  const values=valueAt(saved[locale],field.path) as Array<{position:string}>
  expect(values.filter(item=>item.position==='featured')).toHaveLength(1)
  expect(values[1]!.position).toBe('featured')
 }
})

it('指标表格解析每行实际字段，数值跨语言同步而显示名称仅更新当前语言',()=>{
 const key='home.statistics',field=collection(key),definition=templateDefinition(key)!,data=source(key),before=structuredClone(data)
 const row=collectionEditorRows(data,'zh',field)[0]!
 expect(field.columns!.map(column=>collectionColumnField(row,column.field)?.key)).toEqual(['name','value','unit'])
 const edit=beginCollectionEdit(data,'zh',definition,field,row.key)
 const number=collectionColumnField(row,'value')!,name=collectionColumnField(row,'name')!
 edit.localized=changeFormValue(edit.localized,'zh',number,row.base,888,field.identity)
 edit.localized=changeFormValue(edit.localized,'zh',name,row.base,'新的指标名称',field.identity)
 expect(data).toEqual(before)
 const saved=finishCollectionEdit(data,edit,definition,field)
 for(const locale of siteLocales)expect(valueAt(saved[locale],fieldPath(number,row.base))).toBe(888)
 expect(valueAt(saved.zh,fieldPath(name,row.base))).toBe('新的指标名称')
 expect(valueAt(saved.en,fieldPath(name,row.base))).toEqual(valueAt(data.en,fieldPath(name,row.base)))
 expect(()=>beginCollectionEdit(data,'zh',definition,field,null)).toThrow('固定条目')
 expect(()=>removeCollectionRow(data,'zh',definition,field,row.key)).toThrow('固定条目')
})

it('指标非法数值不会进入临时草稿，原稿变化后拒绝覆盖',()=>{
 const key='home.statistics',field=collection(key),definition=templateDefinition(key)!,data=source(key)
 const row=collectionEditorRows(data,'zh',field)[0]!,edit=beginCollectionEdit(data,'zh',definition,field,row.key)
 const number=collectionColumnField(row,'value') as ValueField
 expect(()=>changeFormValue(edit.localized,'zh',number,row.base,-1,field.identity)).toThrow()
 const changed=changeFormValue(data,'zh',number,row.base,777,field.identity)
 expect(()=>finishCollectionEdit(changed,edit,definition,field)).toThrow('页面内容已变化')
})
