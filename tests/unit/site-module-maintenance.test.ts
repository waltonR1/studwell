import {beforeEach,expect,it,vi} from 'vitest'
import {websiteModulePolicySchema} from '../../shared/schemas/website/module-policy'
import {assertDisabledModulesUnused,publishedModuleUsage,readSiteModuleState,updateSiteModuleState} from '../../server/services/site-module-maintenance'
import type {Database} from '../../server/db/transaction'
const mock=vi.hoisted(()=>({all:vi.fn(),release:vi.fn(),read:vi.fn(),save:vi.fn(),lock:vi.fn(),rebuild:vi.fn(),permission:vi.fn(),snapshot:vi.fn(),guard:vi.fn(),audit:vi.fn()}))
vi.mock('../../server/repositories/website-resources',()=>({websiteResourceRepository:{all:mock.all,release:mock.release}}))
vi.mock('../../server/repositories/website-module-policy',()=>({readWebsiteModulePolicy:mock.read,saveWebsiteModulePolicy:mock.save}))
vi.mock('../../server/repositories/website-site-config',()=>({lockSiteConfig:mock.lock}))
vi.mock('../../server/repositories/tasks',()=>({taskRepository:{requestSearchRebuild:mock.rebuild}}))
vi.mock('../../server/services/access/permissions',()=>({requirePermission:mock.permission,getPermissionSnapshot:mock.snapshot}))
vi.mock('../../server/services/website-publication-guards',()=>({assertPublishedPolicyDependencies:mock.guard}))
vi.mock('../../server/services/audit',()=>({auditService:{write:mock.audit,failure:vi.fn()}}))
const policy=()=>websiteModulePolicySchema.parse({enabled:{news:true,careers:true},pages:{journal:['news']},templates:{custom:{modules:['inquiries'],provides:['inquiries.form'],requires:[]}}})
const db={transaction:vi.fn(async work=>work(db))} as unknown as Database
const meta={requestId:'test',ip:'127.0.0.1',userAgent:'test'}
beforeEach(()=>{vi.clearAllMocks();mock.all.mockResolvedValue([]);mock.read.mockResolvedValue({version:4,policy:policy()});mock.snapshot.mockResolvedValue({isRoot:false,permissions:['content.news.read']});mock.permission.mockResolvedValue({isRoot:true})})
it('defaults legacy inquiries to enabled',()=>expect(policy().enabled.inquiries).toBe(true))
it('finds page mapping and readable published names',()=>expect(publishedModuleUsage(policy(),'news','journal',{settings:{displayName:{zh:'新闻中心'}}})).toEqual({key:'journal',name:'新闻中心',sectionNames:[]}))
it('uses visible template rules regardless of page/template name',()=>{
 const content={sections:[{visible:true,templateKey:'custom',name:'联系表单'}]}
 expect(publishedModuleUsage(policy(),'inquiries','anything',content)?.sectionNames).toEqual(['联系表单'])
 expect(publishedModuleUsage(policy(),'inquiries','anything',{sections:[{...content.sections[0],visible:false}]})).toBeNull()
})
it('rejects disabling with readable published references',async()=>{
 mock.all.mockResolvedValue([{id:1n,type:'page',key:'page.journal',publishedReleaseId:2n}]);mock.release.mockResolvedValue({content:{settings:{displayName:{zh:'新闻中心'}}}})
 const next=policy();next.enabled.news=false
 await expect(assertDisabledModulesUnused(db,next)).rejects.toMatchObject({reason:'REFERENCED',fields:[{path:'enabled',message:expect.stringContaining('新闻中心')}]})
})
it('ignores unpublished drafts',async()=>{mock.all.mockResolvedValue([{id:1n,type:'page',key:'page.journal',publishedReleaseId:null}]);const next=policy();next.enabled.news=false;await assertDisabledModulesUnused(db,next);expect(mock.release).not.toHaveBeenCalled()})
it('allows read-only users to inspect status',async()=>{await expect(readSiteModuleState(db,1n,'news')).resolves.toMatchObject({module:'news',version:4,enabled:true,usages:[]})})
it('allows inquiry settings maintainers to inspect status',async()=>{mock.snapshot.mockResolvedValue({isRoot:false,permissions:['content.inquiries.settings']});await expect(readSiteModuleState(db,1n,'inquiries')).resolves.toMatchObject({enabled:true})})
it('rejects unrelated readers',async()=>{mock.snapshot.mockResolvedValue({isRoot:false,permissions:[]});await expect(readSiteModuleState(db,1n,'news')).rejects.toMatchObject({code:'FORBIDDEN'})})
it('locks before checking stale versions and never writes',async()=>{await expect(updateSiteModuleState(db,1n,'news',{version:3,enabled:false},meta)).rejects.toMatchObject({reason:'STALE'});expect(mock.lock).toHaveBeenCalled();expect(mock.save).not.toHaveBeenCalled();expect(mock.rebuild).not.toHaveBeenCalled()})
it('only changes module policy and schedules rebuild with audit',async()=>{
 await updateSiteModuleState(db,1n,'news',{version:4,enabled:false},meta)
 expect(mock.permission).toHaveBeenCalledWith(db,1n,'content.modules.update')
 expect(mock.save).toHaveBeenCalledWith(db,{...policy(),enabled:{news:false,careers:true,inquiries:true}},4)
 expect(mock.lock.mock.invocationCallOrder[0]).toBeLessThan(mock.read.mock.invocationCallOrder[0]!)
 expect(mock.rebuild).toHaveBeenCalledOnce();expect(mock.audit).toHaveBeenCalledOnce()
})
it('non-root users cannot change module status even with a granted management permission',async()=>{
 mock.permission.mockResolvedValue({isRoot:false})
 await expect(updateSiteModuleState(db,1n,'news',{version:4,enabled:false},meta)).rejects.toMatchObject({code:'FORBIDDEN'})
 expect(mock.lock).not.toHaveBeenCalled();expect(mock.save).not.toHaveBeenCalled()
})
it('enabling one module is not blocked by legacy published pages of another disabled module',async()=>{
 const current=policy();current.enabled.news=false;current.enabled.inquiries=false
 mock.read.mockResolvedValue({version:4,policy:current})
 mock.all.mockResolvedValue([{id:1n,type:'page',key:'page.journal',publishedReleaseId:2n}])
 mock.release.mockResolvedValue({content:{settings:{displayName:{zh:'旧新闻页面'}}}})
 await expect(updateSiteModuleState(db,1n,'inquiries',{version:4,enabled:true},meta)).resolves.toMatchObject({module:'inquiries'})
 expect(mock.save).toHaveBeenCalledWith(db,expect.objectContaining({enabled:{news:false,careers:true,inquiries:true}}),4)
})
