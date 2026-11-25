import {beforeEach, describe, expect, it, vi} from 'vitest'
import {nextTick, reactive} from 'vue'
import {createPinia, setActivePinia} from 'pinia'
import {createSiteSettings,createSiteLink} from '../../shared/utils/admin/site-settings'
import type {SiteSettingsRecord} from '../../shared/types/admin/site-settings'
const state = vi.hoisted(() => ({read: vi.fn(), mutate: vi.fn(), operationMessage: vi.fn(), session: {generation: 0, can: () => true}}))
vi.mock('~/stores/admin/request', () => ({useAdminRequestStore: () => ({read: state.read, mutate: state.mutate, message: () => '加载失败', operationMessage: state.operationMessage})}))
vi.mock('~/stores/admin/session', () => ({useAdminSessionStore: () => state.session}))
import {useAdminSiteSettingsStore} from '../../app/stores/admin/site-settings'
const record = (): SiteSettingsRecord => ({content: createSiteSettings(), versions: {basic: 1, header: 1, footer: 1}, updatedAt: null, updatedBy: null, targets: []})
beforeEach(() => {
    setActivePinia(createPinia())
    state.session = reactive({generation: 0, can: () => true}); state.read.mockReset(); state.mutate.mockReset(); state.operationMessage.mockReset().mockReturnValue('保存失败')
})
describe('公共配置分区草稿', () => {
    it('导航显隐只修改当前草稿，拒绝外部列表和只读操作',async()=>{
        const data=record()
        data.content.header.items=[{...createSiteLink('nav'),children:[]}]
        state.read.mockResolvedValue(data)
        const store=useAdminSiteSettingsStore();await store.load()
        const rows=store.draft.header.items
        store.setNavigationVisible(rows,0,false)
        expect(rows[0]!.visible).toBe(false);expect(store.record!.content.header.items[0]!.visible).toBe(true)
        const external=[{visible:true}];store.setNavigationVisible(external,0,false);expect(external[0]!.visible).toBe(true)
        state.session.can=()=>false
        store.setNavigationVisible(rows,0,true);expect(rows[0]!.visible).toBe(false)
    })
    it('只保存当前分区，保留其他未保存修改及其原版本', async () => {
        state.read.mockResolvedValue(record())
        const form = useAdminSiteSettingsStore(); await form.load()
        form.draft.footer.description.zh = '页脚草稿'
        form.draft.header.tagline.zh = '本地未保存导航说明'
        const server = record(); server.content.footer.description.zh = '页脚草稿'; server.versions.footer = 2
        server.versions.header = 3; server.content.header.tagline.zh = '别人保存的导航说明'
        server.content.basic.logoId = '2026103014000000001'; server.versions.basic = 4
        state.mutate.mockResolvedValue(server)
        await form.save('footer')
        expect(state.mutate.mock.calls[0]![2]).toEqual({section: 'footer', version: 1, content: form.record!.content.footer})
        expect(form.draft.header.tagline.zh).toBe('本地未保存导航说明')
        expect(form.record!.versions.header).toBe(1)
        expect(form.record!.content.header.tagline.zh).toBe('')
        expect(form.draft.basic.logoId).toBe('2026103014000000001')
        expect(form.dirtySections).toEqual(['header'])
    })
    it('保存失败保留草稿及版本，切换账号清空资料', async () => {
        state.read.mockResolvedValue(record())
        const form = useAdminSiteSettingsStore(); await form.load()
        form.draft.basic.logoId = '2026103014000000001'
        state.mutate.mockRejectedValue(new Error('conflict'))
        await form.save('basic')
        expect(form.draft.basic.logoId).toBe('2026103014000000001')
        expect(form.record!.versions.basic).toBe(1)
        expect(form.saveError).toBe('')
        state.session.generation++; await nextTick()
        expect(form.record).toBeNull()
        expect(form.draft.basic.logoId).toBeNull()
    })
    it('忽略旧账号未完成请求的返回值', async () => {
        let finish: (value: SiteSettingsRecord) => void = () => {}
        state.read.mockReturnValue(new Promise<SiteSettingsRecord>(resolve => {finish = resolve}))
        const form = useAdminSiteSettingsStore(), pending = form.load()
        state.session.generation++; await nextTick()
        finish(record()); await pending
        expect(form.record).toBeNull()
    })
    it('保存成功返回单次通知，失败保留字段错误；全局恢复错误不重复提示', async () => {
        state.read.mockResolvedValue(record())
        const form=useAdminSiteSettingsStore();await form.load()
        form.draft.basic.logoId='2026103014000000001'
        const saved=record();saved.content.basic.logoId=form.draft.basic.logoId;saved.versions.basic=2
        state.mutate.mockResolvedValue(saved)
        expect(await form.save('basic')).toEqual({status:'success',message:'网站标识已保存。'})
        expect(await form.save('basic')).toBeNull()
        expect(state.mutate).toHaveBeenCalledTimes(1)
        form.draft.basic.logoId=null
        state.mutate.mockRejectedValue(new Error('csrf'))
        state.operationMessage.mockReturnValue('')
        expect(await form.save('basic')).toBeNull();expect(form.saveError).toBe('')
    })
    it('发布和回滚失败返回错误Toast，不写入弹窗背后的保存错误', async () => {
        const current=record()
        current.publication=Object.fromEntries(['basic','header','footer'].map(section=>[section,{stateVersion:1,changedSections:[section],draftVersion:1,publishedReleaseId:null,publishedDraftVersion:null,releases:[]}])) as SiteSettingsRecord['publication']
        state.read.mockResolvedValue(current)
        const form=useAdminSiteSettingsStore();await form.load()
        state.mutate.mockRejectedValue(new Error('failure'));state.operationMessage.mockReturnValue('请重试')
        expect(await form.publish('footer')).toEqual({status:'error',message:'请重试'})
        expect(await form.publish('footer','2026103117000000001')).toEqual({status:'error',message:'请重试'})
        expect(form.saveError).toBe('')
        expect(state.mutate.mock.calls[0]![0]).toBe('website-resources/site.footer/publish')
        expect(state.mutate.mock.calls[1]![0]).toBe('website-resources/site.footer/restore')
        state.operationMessage.mockReturnValue('')
        expect(await form.publish('footer')).toBeNull()
    })
    it('离开页面后旧保存结果不能重建草稿或产生成功通知', async () => {
        state.read.mockResolvedValue(record())
        const form=useAdminSiteSettingsStore();await form.enter('basic')
        form.draft.basic.logoId='2026103014000000001'
        let finish!:(value:SiteSettingsRecord)=>void
        state.mutate.mockReturnValue(new Promise(resolve=>{finish=resolve}))
        const pending=form.save('basic');form.leave('basic')
        finish(record());expect(await pending).toBeNull();expect(form.record).toBeNull()
    })
    it('关闭历史详情后丢弃迟到响应', async () => {
        const form=useAdminSiteSettingsStore()
        let finish!:(value:unknown)=>void
        state.read.mockReturnValue(new Promise(resolve=>{finish=resolve}))
        const pending=form.loadDetail('footer','2026103117000000001');form.closeDetail()
        finish({id:'2026103117000000001'});await pending
        expect(form.releaseDetail).toBeNull();expect(form.detailPending).toBe(false)
    })

    it('撤销编辑/发布权限后不发起写请求', async () => {
        state.read.mockResolvedValue(record())
        const form=useAdminSiteSettingsStore();await form.enter('basic')
        form.draft.basic.logoId='2026103014000000001'
        state.session.can=()=>false
        expect(form.canEdit).toBe(false)
        form.draft.header.items=[{id:'existing',label:{zh:'原名称',en:'',fr:'',es:'',pt:''},target:{module:'home',resourceId:'1',type:'page',value:''},visible:true,children:[]}]
        form.editLink('header',0)
        expect(form.navigationEditor).not.toBeNull()
        form.navigationEditor!.value.label.zh='只读修改尝试'
        form.confirmNavigation('zh')
        expect(form.draft.header.items[0]!.label.zh).toBe('原名称')
        expect(await form.save('basic')).toBeNull()
        expect(await form.publish('basic')).toBeNull()
        expect(state.mutate).not.toHaveBeenCalled()
    })

})
