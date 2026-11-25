import {sectionContentSchema} from '../../shared/schemas/website/section-content'
import type {LocalizedSections} from '../../app/types/admin/website-section-editors'
import {expect,it} from 'vitest'
import fixture from '../fixtures/website-content.json'
import {siteLocales} from '../../shared/schemas/admin/site-settings'
import {templateDefinition} from '../fixtures/reference/template-catalog'
import {emptySectionContent} from '../../shared/utils/website/page-layouts'


import {editLocale,editBannerImage,editBannerMedia} from '../../app/utils/admin/website/section-editors'

type BannerContent={copy:{title:string};data:{topics:Array<{slug:string;labelKey:string;summaryKey:string;image:{mediaId:string|null}}>}}
import {sectionForms as aboutHeroFormForms} from '../fixtures/template-forms'
const aboutHeroForm=aboutHeroFormForms['hero.about']!;
import {valueAt} from '../../app/utils/admin/website/section-forms'




function content(key:string):LocalizedSections{
 const source=fixture.pages.flatMap(page=>page.sections).find(section=>section.templateKey===key)!
 function rewrite(value:unknown):unknown{
  if(Array.isArray(value))return value.map(rewrite)
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,value])=>[key,key==='mediaId'&&value?'2026110214000000001':rewrite(value)]))
  return value
 }
 return rewrite(source.localized) as LocalizedSections
}
function blank(key:string):LocalizedSections{
 const definition=templateDefinition(key)!
 return Object.fromEntries(siteLocales.map(locale=>[locale,emptySectionContent(definition.fields)])) as LocalizedSections
}
function validate(key:string,localized:LocalizedSections){
 const schema=sectionContentSchema(templateDefinition(key)!.fields)
 for(const locale of siteLocales)expect(schema.safeParse(localized[locale]).success,locale).toBe(true)
}

it('企业横幅视频按语言保存，兼容旧内容且换封面和清除视频不会覆盖彼此',()=>{
 const original=content('hero.about'),before=structuredClone(original)
 const field=aboutHeroForm.groups.flatMap(group=>group.fields).find(field=>field.kind==='bannerImages')!
 if(field.kind!=='bannerImages'||!field.videoPath)throw new Error('缺少横幅视频字段')
 const references={...field,videoPath:field.videoPath}
 validate('hero.about',original)
 const selected=editBannerMedia(original,'zh',0,'profile',{id:'2026110214000000002',kind:'video'},references)
 const covered=editBannerImage(selected,'zh',0,'profile','2026110214000000003',{path:'data.topics',identityPath:'slug',imagePath:'image',defaults:{labelKey:'about.heroSection.title',summaryKey:'about.heroSection.intro'}})
 expect(valueAt(covered.zh,'data.heroVideo.mediaId')).toBe('2026110214000000002')
 expect(valueAt(covered.zh,'data.topics.0.image.mediaId')).toBe('2026110214000000003')
 for(const locale of siteLocales.filter(locale=>locale!=='zh'))expect(covered[locale]).toEqual(original[locale])
 validate('hero.about',covered)
 const switched=editBannerMedia(covered,'zh',0,'profile',{id:'2026110214000000004',kind:'image'},references)
 expect(valueAt(switched.zh,'data.heroVideo.mediaId')).toBeNull()
 expect(valueAt(switched.zh,'data.topics.0.image.mediaId')).toBe('2026110214000000004')
 const cleared=editBannerMedia(covered,'zh',0,'profile',null,references)
 expect(valueAt(cleared.zh,'data.topics.0.image.mediaId')).toBeNull()
 expect(valueAt(cleared.zh,'data.heroVideo.mediaId')).toBeNull()
 expect(original).toEqual(before)
 validate('hero.about',cleared)
})

it('横幅编辑保留栏目关联和其他语言，换图仍符合当前内容合同',()=>{
 const original=content('hero.about'),before=structuredClone(original)
 const changed=editLocale<BannerContent>(original,'zh',value=>{value.copy.title='新的横幅标题'})
 const next=editBannerImage(changed,'zh',0,'profile','2026110214000000002',{path:'data.topics',identityPath:'slug',imagePath:'image',defaults:{labelKey:'about.heroSection.title',summaryKey:'about.heroSection.intro'}})
 expect(original).toEqual(before)
 expect((next.zh as BannerContent).copy.title).toBe('新的横幅标题')
 expect((next.zh as BannerContent).data.topics[0]).toEqual({...((original.zh as BannerContent).data.topics[0]),image:{mediaId:'2026110214000000002'}})
 for(const locale of siteLocales.filter(locale=>locale!=='zh'))expect(next[locale]).toEqual(original[locale])
 validate('hero.about',next)
})

it('空白横幅创建稳定的栏目关联，各语言图片可独立维护',()=>{
 const original=blank('hero.about'),next=editBannerImage(original,'zh',null,'custom-column','2026110214000000001',{path:'data.topics',identityPath:'slug',imagePath:'image',defaults:{labelKey:'about.heroSection.title',summaryKey:'about.heroSection.intro'}})
 for(const locale of siteLocales){
  const topic=(next[locale] as BannerContent).data.topics[0]!
  expect(topic.slug).toBe('custom-column')
  expect(topic.image.mediaId).toBe(locale==='zh'?'2026110214000000001':null)
 }
 expect((original.zh as BannerContent).data.topics).toHaveLength(0)
 validate('hero.about',next)
})

it('通用横幅首次选择图片只写入当前内容合同的字段',()=>{
 const original=blank('hero.column'),field={kind:'bannerImages' as const,label:'横幅媒体',path:'data.topics',identityPath:'slug',imagePath:'image',defaults:{labelKey:'',summaryKey:''},videoPath:'data.heroVideo'}
 const next=editBannerMedia(original,'zh',null,'custom-column',{id:'2026110214000000001',kind:'image'},field)
 for(const locale of siteLocales){
  const topic=(next[locale] as BannerContent).data.topics[0]!
  expect(topic).toMatchObject({slug:'custom-column',labelKey:'',summaryKey:'',image:{mediaId:locale==='zh'?'2026110214000000001':null}})
  expect(topic).not.toHaveProperty('kind')
  expect(topic).not.toHaveProperty('label')
  expect(topic).not.toHaveProperty('videoPath')
 }
 expect((original.zh as BannerContent).data.topics).toHaveLength(0)
 validate('hero.column',next)
})

it('横幅扩展声明不同数据路径时，不读写预设路径或额外业务字段',()=>{
 const original=Object.fromEntries(siteLocales.map(locale=>[locale,{data:{visuals:[]}}])) as LocalizedSections
 const result=editBannerImage(original,'en',null,'hero','2026110214000000001',{path:'data.visuals',identityPath:'key',imagePath:'picture',defaults:{}})
 expect(result.en).toEqual({data:{visuals:[{key:'hero',picture:{mediaId:'2026110214000000001'}}]}})
 expect(result.zh).toEqual({data:{visuals:[{key:'hero',picture:{mediaId:null}}]}})
})
