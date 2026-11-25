import {fixtureModulePolicy} from '../fixtures/website-module-policy'
vi.mock('../../server/repositories/website-module-policy',()=>({readWebsiteModulePolicy:async()=>({version:1,policy:fixtureModulePolicy})}))
import {hasBannerVideo} from '../../server/policies/website-banner'
import {expect,it,vi} from 'vitest'
import type {DatabaseExecutor} from '../../server/db/transaction'
import {templateDefinition} from '../fixtures/reference/template-catalog'
import {websiteTemplateCatalog} from '../fixtures/reference/template-catalog'
const state=vi.hoisted(()=>({list:vi.fn(),revisions:vi.fn(),menus:vi.fn()}))
vi.mock('../../server/repositories/menus',()=>({menuRepository:{all:state.menus}}))
vi.mock('../../server/repositories/website-templates',()=>({websiteTemplateRepository:{list:state.list,revisions:state.revisions}}))
import {websiteTemplates,websiteTemplateCatalog as readCatalog,templateBusinessModules} from '../../server/services/website-template-catalog'
import {templateScope} from '../../app/utils/admin/website/templates'

it('目录按显式页面绑定返回适用范围，不受预览页面、菜单 URL 或可见性影响',async()=>{
 const base={id:1n,key:'custom.section',name:'模板',description:'',coverMediaId:null,enabledForNew:true,metadataVersion:1}
 state.list.mockResolvedValue([base,{...base,id:2n},{...base,id:3n}])
 const definition=websiteTemplateCatalog[0]!
 state.revisions.mockResolvedValue([
  {templateId:1n,version:1,definition:{...definition,allowedPages:['custom','missing']}},
  {templateId:2n,version:1,definition:{...definition,allowedPages:'all'}},
 ])
 state.menus.mockResolvedValue([
  {pageKey:'website_page',code:'website_custom',name:'自定义页面',path:'/unrelated',visible:false},
  {pageKey:'users',code:'website_missing',name:'非页面入口',path:'/admin/website/missing'},
 ])
 const result=await readCatalog({} as DatabaseExecutor)
 expect(result[0]!.applicablePages).toEqual([{key:'custom',name:'自定义页面'},{key:'missing',name:null}])
 expect(templateScope(result[0]!.applicablePages)).toBe('自定义页面、未登记页面（missing）')
 expect(templateScope(result[1]!.applicablePages)).toBe('全部页面')
 expect(templateScope(result[2]!.applicablePages)).toBe('历史遗留')
})

it('模板目录保留后台资料，并明确返回未注册定义而非静默隐藏',async()=>{
    const definition=websiteTemplateCatalog[0]!
    const base={id:1n,key:definition.key,name:'后台名称',description:'后台说明',
        coverMediaId:null,enabledForNew:false,metadataVersion:9,}
    state.list.mockResolvedValue([base,{...base,id:2n,key:'removed.definition',enabledForNew:true}])
    state.revisions.mockResolvedValue([{templateId:1n,version:2,definition}])
    const result=await websiteTemplates({} as DatabaseExecutor)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({name:'后台名称',description:'后台说明',coverMediaId:null,enabledForNew:false,metadataVersion:9})
    expect(result[0]!.definition?.key).toBe(definition.key)
    expect(result[1]!.definition).toBeNull()
})

it('普通业务页头不标 API，数据列表、详情和表单按能力标记',()=>{
 const policy={enabled:{news:true,careers:true,inquiries:true},pages:{},templates:{
  'custom.heading':{modules:['news' as const],provides:[],requires:[]},
  'custom.recommendations':{modules:['news' as const],provides:[],requires:['news.list']},
  'custom.story':{modules:['news' as const],provides:['news.article'],requires:[]},
  'custom.jobs':{modules:['careers' as const],provides:['careers.positions'],requires:[]},
  'custom.form':{modules:['inquiries' as const],provides:['inquiries.form'],requires:[]},
 }}
 expect(templateBusinessModules(policy,'custom.heading')).toEqual([])
 expect(templateBusinessModules(policy,'custom.recommendations').map(item=>item.key)).toEqual(['news'])
 expect(templateBusinessModules(policy,'custom.story').map(item=>item.key)).toEqual(['news'])
 expect(templateBusinessModules(policy,'custom.jobs').map(item=>item.key)).toEqual(['careers'])
 expect(templateBusinessModules(policy,'custom.form').map(item=>item.key)).toEqual(['inquiries'])
})

it('模板资料只接受并发版本与可编辑资料，接受可选封面并拒绝模板版本',async()=>{
 const {websiteTemplateUpdateSchema}=await import('../../shared/schemas/admin/website-pages')
 const input={version:1,name:'首屏',description:'说明',coverMediaId:null,enabledForNew:true}
 expect(websiteTemplateUpdateSchema.safeParse(input).success).toBe(true)
 expect(websiteTemplateUpdateSchema.safeParse({...input,coverMediaId:'invalid'}).success).toBe(false)
 expect(websiteTemplateUpdateSchema.safeParse({...input,implementationVersion:'1.0.0'}).success).toBe(false)
 expect(websiteTemplateUpdateSchema.safeParse({...input,schemaVersion:1}).success).toBe(false)
})

it('停用的业务模板仍可发现，并返回业务状态与维护入口',async()=>{
 fixtureModulePolicy.enabled.news=false
 fixtureModulePolicy.templates['customer.feed']={modules:['news'],provides:['news.list'],requires:[]}
 state.list.mockResolvedValue([{id:8n,key:'customer.feed',name:'新闻',description:'',coverMediaId:null,enabledForNew:true,metadataVersion:1}])
 state.revisions.mockResolvedValue([])
 try{
  expect(await websiteTemplates({} as DatabaseExecutor)).toEqual([expect.objectContaining({key:'customer.feed',businessModules:[{key:'news',name:'新闻',enabled:false,path:'/admin/news/articles'}]})])
 }finally{fixtureModulePolicy.enabled.news=true;delete fixtureModulePolicy.templates['customer.feed']}
})

it('Hero 模板使用角色优先 key，首页场景 Hero 保持独立',()=>{
 expect(websiteTemplateCatalog.filter(template=>template.key.endsWith('.heroSection'))).toHaveLength(0)
 expect(websiteTemplateCatalog.filter(template=>template.key.startsWith('hero.'))).toHaveLength(8)
 expect(templateDefinition('hero.about')?.banner).toMatchObject({family:'consolidated',videoPath:'data.heroVideo'})
 expect(templateDefinition('hero.column')?.banner).toMatchObject({family:'consolidated',videoPath:'data.heroVideo'})
 expect(hasBannerVideo(templateDefinition('hero.about')?.banner?.videoPath,{data:{heroVideo:{mediaId:'video'}}})).toBe(true)
 expect(hasBannerVideo(templateDefinition('export.overviewSection')?.banner?.videoPath,{data:{heroVideo:{mediaId:'video'}}})).toBe(false)
 for(const key of ['hero.investment','hero.sustainability']){
  expect(templateDefinition(key)).toBeUndefined()
  expect(websiteTemplateCatalog.some(template=>template.key===key)).toBe(false)
 }
})
