import {beforeEach,expect,it,vi} from 'vitest'
import type {DatabaseExecutor} from '../../server/db/transaction'
import type {WebsiteResource} from '../../server/services/website-read-model'
import {assertPublicationDependencies,assertWithdrawalDependencies,assertPublishedPolicyDependencies} from '../../server/services/website-publication-guards'
const mock=vi.hoisted(()=>({all:vi.fn(),release:vi.fn()}))
vi.mock('../../server/repositories/website-resources',()=>({websiteResourceRepository:mock}))
vi.mock('../../server/repositories/website-module-policy',()=>({readWebsiteModulePolicy:async()=>({version:1,policy:{enabled:{news:true,careers:true,inquiries:true},pages:{},templates:{'custom.feed':{modules:['news'],provides:['article-feed'],requires:[]},'custom.cards':{modules:['news'],provides:[],requires:['article-feed']}}}})}))
const db={} as DatabaseExecutor
const page=(id:bigint,key:string)=>({id,key:'page.'+key,type:'page',publishedReleaseId:id+10n}) as WebsiteResource
const provider=page(1n,'journal'),consumer=page(2n,'services')
const content=(templateKey:string,visible=true)=>({sections:[{templateKey,visible}]})
beforeEach(()=>{vi.clearAllMocks();mock.all.mockResolvedValue([provider,consumer]);mock.release.mockImplementation(async(_db,id)=>({content:content(id===11n?'custom.feed':'custom.cards')}))})
it('任意页面与模板代称通过数据库能力规则建立依赖',async()=>{await expect(assertPublicationDependencies(db,consumer,content('custom.cards'))).resolves.toBeUndefined()})
it('普通页面上的依赖阻止最后一个提供者下线',async()=>{await expect(assertWithdrawalDependencies(db,provider)).rejects.toMatchObject({code:'CONFLICT',reason:'DEPENDENCY_UNAVAILABLE'})})
it('多个提供者允许下线其中一个',async()=>{mock.all.mockResolvedValue([provider,consumer,page(3n,'archive')]);mock.release.mockImplementation(async(_db,id)=>({content:content(id===12n?'custom.cards':'custom.feed')}));await expect(assertWithdrawalDependencies(db,provider)).resolves.toBeUndefined()})
it('隐藏的依赖区块不阻止提供者下线',async()=>{mock.release.mockResolvedValue({content:content('custom.cards',false)});await expect(assertWithdrawalDependencies(db,provider)).resolves.toBeUndefined()})
it('历史恢复也重新校验当前数据库依赖',async()=>{mock.all.mockResolvedValue([consumer]);await expect(assertPublicationDependencies(db,consumer,content('custom.cards'))).rejects.toMatchObject({reason:'DEPENDENCY_UNAVAILABLE'})})

it('修改模块规则不能把已停用页面算作仍在展示区块的能力提供者',async()=>{
 const policy={enabled:{news:true,careers:false,inquiries:true},pages:{journal:['careers' as const]},templates:{'custom.feed':{modules:[],provides:['article-feed'],requires:[]},'custom.cards':{modules:[],provides:[],requires:['article-feed']}}}
 await expect(assertPublishedPolicyDependencies(db,policy)).rejects.toMatchObject({reason:'DEPENDENCY_UNAVAILABLE'})
})
