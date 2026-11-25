import {expect,it,vi} from 'vitest'
// 模拟系统增加资源语言，验证初始化和合同不再依赖旧的五键字面量。
vi.mock('../../shared/config/site-languages',async importOriginal=>{
 const actual=await importOriginal<typeof import('../../shared/config/site-languages')>()
 return {...actual,supportedLocales:[...actual.supportedLocales,'de']}
})
import {emptyPageSettings} from '../../shared/utils/website/page-layouts'
import {websitePageSettingsSchema} from '../../shared/schemas/website/page-settings'
import {createSiteSettings,emptySiteText} from '../../shared/utils/admin/site-settings'
import {siteSettingsSchema} from '../../shared/schemas/admin/site-settings'
import {emptyNewsContent,newsContentSchema} from '../../shared/schemas/admin/news'
import {createLocalized} from '../../shared/utils/localized'
import {careerContentSchema} from '../../shared/schemas/admin/careers'
import {inquiryCategorySettingsSchema} from '../../shared/schemas/admin/inquiry-settings'
it('新增资源语言自动进入初始化、页面、公共设置、新闻、招聘和咨询合同',()=>{
 const page=emptyPageSettings()
 expect(Object.keys(page.displayName)).toContain('de')
 expect(websitePageSettingsSchema.safeParse(page).success).toBe(true)
 expect(siteSettingsSchema.safeParse(createSiteSettings()).success).toBe(true)
 expect(Object.keys(emptySiteText())).toContain('de')
 const news=emptyNewsContent('1')
 expect(newsContentSchema.safeParse(news).success).toBe(true)
 const career={sortOrder:0,localized:createLocalized(()=>({title:'',department:'',location:'',responsibilities:[],requirements:[]}))}
 expect(careerContentSchema.safeParse(career).success).toBe(true)
 expect(inquiryCategorySettingsSchema.safeParse({code:'general',labels:emptySiteText(),enabled:true,forwardTo:'',defaultAssigneeId:''}).success).toBe(true)
 const missing={...page.displayName};delete (missing as Record<string,string>).de
 expect(websitePageSettingsSchema.safeParse({...page,displayName:missing}).success).toBe(true)
 expect(websitePageSettingsSchema.safeParse({...page,displayName:{...page.displayName,unsupported:''}}).success).toBe(false)
})
it('语言槽位使用独立对象，编辑一种语言不会修改其他语言',()=>{
 const news=emptyNewsContent('1')
 news.localized.en.body.push({type:'paragraph',text:'English only'})
 expect(Object.values(news.localized).filter(value=>value!==news.localized.en).every(value=>value.body.length===0)).toBe(true)
})

it('新增德语资源后五语言原始数据仍可校验，解析不补键、不改写源对象',()=>{
 const withoutGerman=(value:unknown):unknown=>Array.isArray(value)?value.map(withoutGerman):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>key!=='de').map(([key,item])=>[key,withoutGerman(item)])):value
 const cases:[{parse:(value:unknown)=>unknown},unknown][]=[
  [websitePageSettingsSchema,emptyPageSettings()],
  [siteSettingsSchema,createSiteSettings()],
  [newsContentSchema,emptyNewsContent('1')],
  [careerContentSchema,{sortOrder:0,localized:createLocalized(()=>({title:'',department:'',location:'',responsibilities:[],requirements:[]}))}],
  [inquiryCategorySettingsSchema,{code:'general',labels:emptySiteText(),enabled:true,forwardTo:'',defaultAssigneeId:''}],
 ]
 for(const [schema,source] of cases){const data=withoutGerman(source),before=JSON.stringify(data);const result=schema.parse(data);expect(result).toEqual(data);expect(JSON.stringify(data)).toBe(before);expect(JSON.stringify(result)).not.toContain('"de":')}
})
