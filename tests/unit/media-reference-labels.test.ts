import {beforeEach,expect,it,vi} from 'vitest'
import type {SectionField} from '../../shared/types/website/section-template'
import {sectionMediaLocation} from '../../server/policies/media-reference-labels'
import {describeMediaReferences} from '../../server/services/media-references'
import {groupMediaReferences} from '../../app/utils/admin/media/references'
import type {DatabaseExecutor} from '../../server/db/transaction'

const mock=vi.hoisted(()=>({context:vi.fn()}))
vi.mock('../../server/repositories/media-reference-context',()=>({readMediaReferenceContext:mock.context}))
const fields:SectionField={kind:'group',label:'内容',fields:{data:{kind:'group',label:'结构化内容',fields:{groups:{kind:'list',label:'图库分组',item:{kind:'group',label:'分组',fields:{id:{kind:'text',label:'标识',searchable:false},name:{kind:'text',label:'分组名称',required:true},images:{kind:'list',label:'图片',item:{kind:'group',label:'图片',fields:{image:{kind:'media',label:'图片'}}}}}}}}}}}
const content=(name:string)=>({data:{groups:[{id:'one',name,images:[{image:{mediaId:'99'}},{image:{mediaId:'99'}}]}]}})
const localized={zh:content('袋装水泥'),en:content('Bags')}
const snapshot={sections:[{id:'2',name:'产品实拍',definition:fields,localized}]}
const context=()=>({
    resources:[{id:1n,key:'page.materials',type:'page',publishedReleaseId:3n}],menus:[{code:'website_materials',name:'水泥产品'}],
    sections:[{section:{id:2n,resourceId:1n,instanceName:'产品实拍',localizedContent:localized,sharedContent:{media:[]}},templateName:'产品图库',definition:{name:'产品图库',fields,mediaSlots:[]}}],
    releases:[{id:3n,resourceId:1n,content:snapshot,createdAt:new Date('2026-11-20T00:00:00Z')},{id:4n,resourceId:1n,content:snapshot,createdAt:new Date('2026-11-19T00:00:00Z')}],
    templates:[],configurations:[],configuration:undefined,articles:[],news:[],
})
beforeEach(()=>{vi.clearAllMocks();mock.context.mockResolvedValue(context())})

it('截图中的十条技术引用合并为草稿和当前发布两个业务位置',async()=>{
    const locales=['en','es','fr','pt','zh']
    const refs=locales.flatMap(locale=>[
        {owner:'website:section:2',field:`localized.${locale}.data.groups.0.images.1.image.mediaId`},
        {owner:'website:release:3',field:`sections.0.localized.${locale}.data.groups.0.images.1.image.mediaId`},
    ])
    const descriptions=await describeMediaReferences({} as DatabaseExecutor,refs)
    expect(descriptions).toHaveLength(10)
    expect(mock.context).toHaveBeenCalledTimes(1)
    const groups=groupMediaReferences(descriptions)
    expect(groups).toHaveLength(2)
    expect(groups.map(row=>row.status)).toEqual(['草稿','当前发布'])
    expect(groups[0]).toMatchObject({source:'水泥产品 · 产品实拍',location:'图库分组 · 袋装水泥 · 图片 · 第 2 张图片'})
    expect(groups[0]!.languages).toContain('中文')
    expect(groups[0]!.locales).toHaveLength(5)
    expect(()=>JSON.stringify(descriptions)).not.toThrow()
})

it('不同图片位置和历史发布版本不能被合并',async()=>{
    const refs=[
        {owner:'website:section:2',field:'localized.en.data.groups.0.images.0.image.mediaId'},
        {owner:'website:section:2',field:'localized.en.data.groups.0.images.1.image.mediaId'},
        {owner:'website:release:4',field:'sections.0.localized.en.data.groups.0.images.0.image.mediaId'},
    ]
    const groups=groupMediaReferences(await describeMediaReferences({} as DatabaseExecutor,refs))
    expect(groups).toHaveLength(3)
    expect(groups[2]!.status).toBe('历史发布 · 2026-11-19 08:00')
})

it('共享槽位使用合同名称，来源缺失时不暴露内部路径且引用仍保留',async()=>{
    expect(sectionMediaLocation(fields,{},'shared.media.0.mediaId',{media:[{key:'cover'}]},[{key:'cover',name:'首屏背景'}])).toBe('首屏背景')
    const refs=await describeMediaReferences({} as DatabaseExecutor,[{owner:'website:section:999',field:'internal.unknown.mediaId'}])
    expect(refs).toHaveLength(1)
    expect(groupMediaReferences(refs)[0]).toMatchObject({source:'原区块记录已不存在',status:'来源待核查',location:'具体位置待核查'})
})

it('SEO 发布记录按页面合并语言，新闻区分封面与正文位置',async()=>{
    const article={localized:{zh:{title:'中文新闻'},en:{title:'English news'}}}
    mock.context.mockResolvedValue({...context(),
        configuration:{publishedReleaseId:7n},
        configurations:[{id:7n,createdAt:new Date(),content:{seo:[{resourceId:'1',locale:'en'},{resourceId:'1',locale:'zh'}]}}],
        articles:[{id:8n,slug:'article',content:article}],
        news:[{release:{id:9n,content:article,createdAt:new Date()},currentReleaseId:9n}],
    })
    const descriptions=await describeMediaReferences({} as DatabaseExecutor,[
        {owner:'website:config:7',field:'seo.0.ogMediaId'},
        {owner:'website:config:7',field:'seo.1.ogMediaId'},
        {owner:'news:draft:8',field:'coverMediaId'},
        {owner:'news:release:9',field:'localized.en.body.2.image.mediaId'},
    ])
    expect(groupMediaReferences(descriptions)).toHaveLength(3)
    expect(descriptions[0]).toMatchObject({source:'水泥产品 · SEO',status:'当前发布',location:'分享图片',locale:'en'})
    expect(descriptions[2]).toMatchObject({source:'新闻 · 中文新闻',status:'草稿',location:'文章封面',locale:null})
    expect(descriptions[3]).toMatchObject({source:'新闻 · 中文新闻',status:'当前发布',location:'正文 · 第 3 段 · 图片',locale:'en'})
})
