import {sectionForms as aboutHeroForms} from '../fixtures/template-forms'
const aboutHero=aboutHeroForms['hero.about']!;
import {templateDefinition} from '../fixtures/reference/template-catalog'
import {beginCollectionEdit,finishCollectionEdit} from '../../app/utils/admin/website/collection-editor'
import {expect,it} from 'vitest'
import type {SectionTemplate} from '../../shared/types/website/section-template'
import type {CollectionField,ValueField} from '../../app/types/admin/website-section-forms'
import {resolveSectionForm} from '../../app/utils/admin/website/section-form-definition'
import {changeFormList,changeFormValue,initializeSectionForm} from '../../app/utils/admin/website/section-forms'
import {emptySectionContent} from '../../shared/utils/website/page-layouts'
import {siteLocales} from '../../shared/schemas/admin/site-settings'
import {sectionContentSchema} from '../../shared/schemas/website/section-content'
const definition:SectionTemplate={key:'custom.unregistered',name:'新模板',dataSource:null,allowedPages:'all',mediaSlots:[],fields:{kind:'group',label:'内容',fields:{copy:{kind:'group',label:'文案',fields:{title:{kind:'text',label:'标题',max:80}}},data:{kind:'group',label:'数据',fields:{items:{kind:'list',label:'条目',item:{kind:'group',label:'条目',fields:{id:{kind:'text',label:'标识'},name:{kind:'text',label:'名称'},enabled:{kind:'boolean',label:'启用'}}}}}}}}}
it('没有代码登记的新模板可以新增条目并按语言编辑，提交仍满足数据库合同',()=>{
 const form=resolveSectionForm(definition),list=form.groups.flatMap(group=>group.fields).find(field=>field.kind==='collection') as CollectionField
 let localized=Object.fromEntries(siteLocales.map(locale=>[locale,emptySectionContent(definition.fields)]))
 localized=changeFormList(localized,'zh',definition,list,'',-1,'add')
 const field=list.fields!.find(field=>'path' in field&&field.path==='name') as ValueField
 localized=changeFormValue(localized,'zh',field,'data.items.0','中文名称')
 expect(localized.zh.data.items[0].name).toBe('中文名称')
 expect(localized.en.data.items[0].name).toBe('')
 expect(localized.zh.data.items[0].id).toBe(localized.en.data.items[0].id)
 expect(localized.zh.data.items[0].id).toMatch(/^entry-/)
 for(const locale of siteLocales)expect(sectionContentSchema(definition.fields).safeParse(localized[locale]).success).toBe(true)
})
it('字段限制、可选媒体和链接从数据库字段读取，不要求专用表单',()=>{
 const form=resolveSectionForm({...definition,key:'custom.other',fields:{kind:'group',label:'数据',fields:{amount:{kind:'number',label:'数量',min:2,max:8},image:{kind:'media',label:'图片',mediaKind:'image',optional:true},link:{kind:'link',label:'链接'}}}})
 expect(form.groups[0]?.fields).toEqual(expect.arrayContaining([expect.objectContaining({kind:'number',path:'amount',min:2,max:8}),expect.objectContaining({kind:'media',path:'image',optional:true}),expect.objectContaining({kind:'link',path:'link'})]))
})

it('没有业务标识字段的树也能编辑，不向合同额外写入 id',()=>{
 const tree:SectionTemplate={...definition,key:'custom.tree',fields:{kind:'group',label:'数据',fields:{nodes:{kind:'list',label:'节点',item:{kind:'tree',label:'节点',fields:{name:{kind:'text',label:'名称'}}}}}}}
 const form=resolveSectionForm(tree),field=form.groups[0]!.fields[0] as CollectionField
 const original=Object.fromEntries(siteLocales.map(locale=>[locale,emptySectionContent(tree.fields)]))
 const edit=beginCollectionEdit(original,'zh',tree,field,null)
 edit.localized=changeFormValue(edit.localized,'zh',field.tree!.levels[0]!.fields[0] as ValueField,'nodes.0','根节点')
 const saved=finishCollectionEdit(original,edit,tree,field)
 expect(saved.zh.nodes[0]).toEqual({name:'根节点',children:[]})
 expect(saved.en.nodes[0]).toEqual({name:'',children:[]})
 expect(field.tree?.allowReparent).toBe(false)
})

it('同名模板的字段合同变更后，不套用失配的特殊界面',()=>{
 const changed={...definition,key:'hero.about',fields:{kind:'group' as const,label:'内容',fields:{replacement:{kind:'text' as const,label:'新字段'}}}}
 expect(resolveSectionForm(changed).groups[0]?.fields).toEqual([expect.objectContaining({path:'replacement'})])
})

it('预设固定条目的默认值只用于新增，不覆盖数据库已有文案',()=>{
 const list=resolveSectionForm(definition).groups[0]!.fields.find(field=>field.kind==='collection') as CollectionField
 const config={key:definition.key,groups:[{title:'条目',fields:[{...list,fixedRows:[{key:'fixed',label:'固定项',fields:list.fields!,bindings:{name:'Preset'}}]}]}]}
 const existing=Object.fromEntries(siteLocales.map(locale=>[locale,{copy:{title:''},data:{items:[{id:'fixed',name:'Database value',enabled:false}]}}]))
 const prepared=initializeSectionForm(existing,config,definition)
 expect(prepared).toEqual(existing)
 const blank=Object.fromEntries(siteLocales.map(locale=>[locale,emptySectionContent(definition.fields)]))
 expect(initializeSectionForm(blank,config,definition).en.data.items[0].name).toBe('Preset')
})

it('数据库布局遗漏新增字段时拒绝静默改用另一份表单',()=>{
 const original=templateDefinition('hero.about')!
 expect(resolveSectionForm(original)).toBe(aboutHero)
 const fields=structuredClone(original.fields)
 if(fields.kind!=='group')throw new Error('Expected grouped fields')
 fields.fields.newCopy={kind:'text',label:'新增文案',max:80}
 expect(()=>resolveSectionForm({...original,fields})).toThrow('Template editor does not match')
})
it('列表条目新增子字段不能被已有集合编辑界面隐藏',()=>{
 const original=templateDefinition('product.gallery')!
 const field=structuredClone(original.fields)
 function add(value:typeof field):boolean{
  if(value.kind==='list'&&value.item.kind==='group'){value.item.fields.newCaption={kind:'text',label:'新增说明'};return true}
  return value.fields?Object.values(value.fields).some(add):false
 }
 expect(add(field)).toBe(true)
 expect(()=>resolveSectionForm({...original,fields:field})).toThrow('Template editor does not match')
})
