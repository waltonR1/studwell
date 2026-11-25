import {validateFixturePublication} from '../fixtures/website-publication'
import {beforeEach,expect,it,vi} from 'vitest'
import {defaultSiteLanguages,supportedLocales} from '../../shared/config/site-languages'
import {siteLanguagesSchema} from '../../shared/schemas/site-languages'
import {readSiteLanguages,resolvePublicLocale} from '../../server/services/site-languages'
import {isManifest,loadSearchIndex} from '../../app/composables/public/runtime/search/indexLoader'
import {emptyPageSettings,emptySectionContent} from '../../shared/utils/website/page-layouts'
import {templateDefinition} from '../fixtures/reference/template-catalog'
import {emptyNewsContent} from '../../shared/schemas/admin/news'
import {assertNewsLanguages,assertCareerLanguages,assertInquiryLanguages} from '../../server/policies/site-language-content'
import type {DatabaseExecutor} from '../../server/db/transaction'
import type {CareerContent} from '../../shared/schemas/admin/careers'
import type {InquirySettings} from '../../shared/schemas/admin/inquiry-settings'

const mocks=vi.hoisted(()=>({state:vi.fn(),release:vi.fn()}))
vi.mock('../../server/repositories/website-site-config',()=>({readSiteConfig:async()=>({publishedReleaseId:null})}))
vi.mock('../../server/repositories/site-languages',()=>({readLanguageConfig:mocks.state,languageRelease:mocks.release}))
const db={} as DatabaseExecutor
const bilingual={enabledLocales:['zh','en'] as Array<'zh'|'en'>,defaultLocale:'zh' as const}
beforeEach(()=>{
 vi.clearAllMocks()
 mocks.state.mockResolvedValue({publishedReleaseId:123n,languages:{enabledLocales:['en'],defaultLocale:'en'}})
 mocks.release.mockResolvedValue({content:bilingual})
})

it.each([
 {enabledLocales:[],defaultLocale:'en'},
 {enabledLocales:['en','en'],defaultLocale:'en'},
 {enabledLocales:['en'],defaultLocale:'zh'},
 {enabledLocales:['de'],defaultLocale:'de'},
])('拒绝不完整或越界的站点语言配置 %j',input=>expect(siteLanguagesSchema.safeParse(input).success).toBe(false))

it('草稿不改变公开语言；省略语言使用已发布默认值，显式停用语言返回 404',async()=>{
 expect(await readSiteLanguages(db,true)).toEqual({enabledLocales:['en'],defaultLocale:'en'})
 expect(await readSiteLanguages(db)).toEqual(bilingual)
 expect(await resolvePublicLocale(db)).toBe('zh')
 expect(await resolvePublicLocale(db,'en')).toBe('en')
 await expect(resolvePublicLocale(db,'fr')).rejects.toMatchObject({code:'NOT_FOUND'})
})

it('未发布配置默认英文；旧结构或损坏的当前版本不会静默回退',async()=>{
 mocks.state.mockResolvedValue({publishedReleaseId:null,languages:bilingual})
 expect(await readSiteLanguages(db)).toEqual(defaultSiteLanguages)
 mocks.state.mockResolvedValue({publishedReleaseId:123n})
 mocks.release.mockResolvedValue({content:{routes:[],seo:[]}})
 await expect(readSiteLanguages(db)).rejects.toThrow()
 mocks.release.mockResolvedValue(undefined)
 await expect(readSiteLanguages(db)).rejects.toMatchObject({code:'INTERNAL_ERROR'})
})

it('两语言索引清单有效，缺少启用语言、额外语言或无元数据的残缺旧清单无效',()=>{
 const versions={zh:'a'.repeat(16),en:'b'.repeat(16)}
 const manifest={schemaVersion:2,modulePolicyVersion:1,modules:{news:true,careers:true},configReleaseId:null,languageReleaseId:null,languages:bilingual,versions}
 expect(isManifest(manifest)).toBe(true)
 expect(isManifest({...manifest,versions:{en:versions.en}})).toBe(false)
 expect(isManifest({...manifest,versions:{...versions,fr:'c'.repeat(16)}})).toBe(false)
 expect(isManifest({...manifest,languages:undefined})).toBe(false)
 expect(isManifest({...manifest,modules:undefined})).toBe(false)
 expect(isManifest({...manifest,modulePolicyVersion:undefined})).toBe(false)
 expect(isManifest({...manifest,languages:undefined,versions:Object.fromEntries(supportedLocales.map(locale=>[locale,'a'.repeat(16)]))})).toBe(false)
})

it('请求停用语言时不读取旧搜索索引或缓存',async()=>{
 const fetch=vi.fn(async()=>({schemaVersion:2,modulePolicyVersion:1,modules:{news:true,careers:true},configReleaseId:null,languageReleaseId:null,languages:bilingual,versions:{zh:'a'.repeat(16),en:'b'.repeat(16)}}))
 vi.stubGlobal('$fetch',fetch)
 try{await expect(loadSearchIndex('fr',new AbortController().signal)).rejects.toThrow('Search locale is disabled');expect(fetch).toHaveBeenCalledTimes(1)}finally{vi.unstubAllGlobals()}
})

it('页面只要求启用语言完整，重新启用缺少内容的语言时阻止发布',async()=>{
 const template=templateDefinition('content.text')!
 const empty=emptySectionContent(template.fields)
 const localized=Object.fromEntries(supportedLocales.map(locale=>[locale,structuredClone(empty)]))
 localized.zh={copy:{title:'服务',body:'中文正文'}}
 localized.en={copy:{title:'Services',body:'English body'}}
 const content={settings:{...emptyPageSettings(),sceneEnabled:false},sections:[{templateKey:'content.text',visible:true,sortOrder:0,anchorKey:'body',localized,shared:{media:[]}}]}
 await expect(validateFixturePublication('services',content,['zh','en'])).resolves.toBeUndefined()
 await expect(validateFixturePublication('services',content,['zh','en','fr'])).rejects.toMatchObject({code:'INVALID_INPUT'})
})

it('新闻、岗位和咨询类型只校验启用语言，重新启用缺失语言会被拦截',()=>{
 const news=emptyNewsContent('2026110521000000001')
 for(const locale of ['zh','en'] as const)Object.assign(news.localized[locale],{title:'Title',summary:'Summary',body:[{type:'paragraph',text:'Body'}]})
 expect(()=>assertNewsLanguages(news,['zh','en'])).not.toThrow()
 expect(()=>assertNewsLanguages(news,['fr'])).toThrow()
 const career={localized:{zh:{title:'职位'},en:{title:'Role'},fr:{title:''}}} as CareerContent
 expect(()=>assertCareerLanguages(career,['zh','en'])).not.toThrow()
 expect(()=>assertCareerLanguages(career,['fr'])).toThrow()
 const inquiry={categories:[{code:'general',enabled:true,labels:{zh:'咨询',en:'Inquiry',fr:''}}]} as InquirySettings
 expect(()=>assertInquiryLanguages(inquiry,['zh','en'])).not.toThrow()
 expect(()=>assertInquiryLanguages(inquiry,['fr'])).toThrow()
})
