import {websitePageSettingsSchema} from '../../shared/schemas/website/page-settings'
import {validateFixturePublication} from '../fixtures/website-publication'
import {expect,it} from 'vitest'
import {emptyPageSettings,normalizeSectionPlacement,emptySectionContent} from '../../shared/utils/website/page-layouts'
import {websitePageUpdateSchema, websiteSectionUpdateSchema} from '../../shared/schemas/admin/website-pages'
import {validateSettings,validateSectionOrdering,validatePagePublication} from '../../server/policies/website-pages'
import {sectionMoveTarget} from '../../app/utils/admin/website/page-assembly'
import type {WebsitePageRecord} from '../../shared/types/admin/website'
import {templateDefinition} from '../fixtures/reference/template-catalog'
import {siteLocales} from '../../shared/schemas/admin/site-settings'
it('页面合同只有名称和独立场景设置，拒绝旧布局配置',()=>{
 const settings=emptyPageSettings()
 expect(settings).toEqual({displayName:{zh:'',en:'',fr:'',es:'',pt:''},sceneEnabled:false,sceneTransitionSeconds:null})
 for(const extra of [{layoutKey:'columns'},{layoutOptions:{columns:[]}},{configured:true},{layoutSchemaVersion:2}])expect(websitePageSettingsSchema.safeParse({...settings,...extra}).success).toBe(false)
 expect(websitePageUpdateSchema.safeParse({version:1,settings,sections:[],removed:[]}).success).toBe(true)
})
it('场景开关与时长一致，普通正文不受页面编码限制',()=>{
 const settings=emptyPageSettings();expect(()=>validateSettings('custom',settings)).not.toThrow()
 settings.sceneEnabled=true;expect(()=>validateSettings('custom',settings)).toThrow()
 for(const seconds of [0.1,0.42,3]){settings.sceneTransitionSeconds=seconds;expect(websitePageSettingsSchema.safeParse(settings).success).toBe(true);expect(()=>validateSettings('custom',settings)).not.toThrow()}
 for(const seconds of [0,3.1])expect(websitePageSettingsSchema.safeParse({...settings,sceneTransitionSeconds:seconds}).success).toBe(false)
})
it('区块只按页面顺序排列，拒绝重复或有空缺的顺序',()=>{
 expect(normalizeSectionPlacement([{id:'b',sortOrder:4},{id:'a',sortOrder:2}])).toEqual([{id:'a',sortOrder:0},{id:'b',sortOrder:1}])
 expect(()=>validateSectionOrdering([{sortOrder:0},{sortOrder:1}])).not.toThrow()
 expect(()=>validateSectionOrdering([{sortOrder:0},{sortOrder:0}])).toThrow()
 expect(()=>validateSectionOrdering([{sortOrder:0},{sortOrder:2}])).toThrow()
})
it('普通页面独立发布，空白与缺少必填文案时拒绝发布',async()=>{
 const definition=templateDefinition('content.text')!,section={id:'2026111320000000001',templateKey:definition.key,anchorKey:'body',sortOrder:0,visible:true,shared:{media:[]},localized:Object.fromEntries(siteLocales.map(locale=>[locale,{copy:{title:'Title',body:'Body'}}]))}
 const content={settings:emptyPageSettings(),sections:[section]}
 await expect(validateFixturePublication('custom',content)).resolves.toBeUndefined()
 await expect(validateFixturePublication('custom',{...content,sections:[]})).rejects.toMatchObject({code:'INVALID_INPUT'})
 section.localized.en=emptySectionContent(definition.fields) as typeof section.localized.en
 await expect(validateFixturePublication('custom',content)).rejects.toMatchObject({code:'INVALID_INPUT'})
})
it('区块编辑接口拒绝目录和栏目扩展字段',()=>{
 const raw={contentVersion:1,structureVersion:1,shared:{media:[]},localized:{zh:{},en:{},fr:{},es:{},pt:{}}}
 expect(websiteSectionUpdateSchema.safeParse(raw).success).toBe(true)
 for(const extra of [{catalog:{}},{columnLabel:{}},{templateId:'2026111319000000001'}])expect(websiteSectionUpdateSchema.safeParse({...raw,...extra}).success).toBe(false)
})
it('模板不强制装配或限制实例数量，场景区块仍可自由移动',async()=>{
 const definition={...templateDefinition('content.text')!,fields:{kind:'group' as const,label:'内容',fields:{}}}
 const section={id:'2026111320000000001',templateKey:definition.key,renderer:definition.key,videoPath:null,name:'内容',allowedPages:'all',anchorKey:'body',sortOrder:0,visible:true,shared:{media:[]},localized:Object.fromEntries(siteLocales.map(locale=>[locale,{}])),definition:definition.fields,mediaSlots:[]}
 const other={...section,id:'2026111320000000002',templateKey:'other',anchorKey:'other'}
 const settings={...emptyPageSettings(),sceneEnabled:true,sceneTransitionSeconds:0.42}
 const sections=[other,{...section,sortOrder:1}]
 await expect(validatePagePublication('custom',{settings,sections})).resolves.toBeDefined()
 await expect(validatePagePublication('custom',{settings,sections:[other]})).resolves.toBeDefined()
 await expect(validatePagePublication('custom',{settings,sections:[section,{...section,id:other.id,anchorKey:'duplicate',sortOrder:1}]})).resolves.toBeDefined()
 expect(sectionMoveTarget({settings,sections} as unknown as WebsitePageRecord,1,-1)).toBe(0)
 expect(sectionMoveTarget({settings,sections} as unknown as WebsitePageRecord,0,1)).toBe(1)
})

it('无模板场景标记的正文可整屏发布，适用页面限制仍生效',async()=>{
 const definition=templateDefinition('content.text')!
 expect(Object.hasOwn(definition,'scene')).toBe(false)
 const settings={...emptyPageSettings(),sceneEnabled:true,sceneTransitionSeconds:0.42}
 const section={id:'2026111320000000001',templateKey:definition.key,renderer:definition.key,videoPath:null,name:definition.name,allowedPages:'all',anchorKey:'body',sortOrder:0,visible:true,shared:{media:[]},localized:Object.fromEntries(siteLocales.map(locale=>[locale,{copy:{title:'长正文',body:'正文内容'.repeat(500)}}])),definition:definition.fields,mediaSlots:[]}
 await expect(validatePagePublication('custom',{settings,sections:[section]})).resolves.toBeDefined()
 await expect(validatePagePublication('custom',{settings,sections:[{...section,allowedPages:['other']}]})).rejects.toMatchObject({code:'INVALID_INPUT'})
})
