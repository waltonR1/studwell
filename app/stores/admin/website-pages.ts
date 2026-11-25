import { type WebsitePageUpdate,type WebsiteSectionUpdate } from '#shared/schemas/admin/website-pages'
import type { WebsitePageRecord,WebsiteReleaseDetail } from '#shared/types/admin/website'
import { normalizeSectionPlacement } from '#shared/utils/website/page-layouts'
import { defineStore } from 'pinia'
import { computed,ref,watch } from 'vue'
import { createWebsitePagesApi } from '~/api/admin/website-pages'
import { createWebsiteResourcesApi } from '~/api/admin/website-resources'
import {createPublicationHistoryApi} from '~/api/admin/publication-history'
import type { AdminActionResult } from '~/types/admin/action-result'
import { getAdminRequestFailure } from '~/utils/admin/request/errors'
import { initializeSectionDraft,sectionFromTemplate,sectionMoveTarget } from '~/utils/admin/website/page-assembly'
import { useAdminNavigationStore } from './navigation'
import { useAdminRequestStore } from './request'
import { useAdminSessionStore } from './session'

const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v))
export const useAdminWebsitePagesStore = defineStore('admin-website-pages', () => {
    const request = useAdminRequestStore(), session = useAdminSessionStore(), api = createWebsitePagesApi(request),
        releases = createWebsiteResourcesApi(request), navigation = useAdminNavigationStore()
    const record = ref<WebsitePageRecord | null>(null), draft = ref<WebsitePageRecord | null>(null),
        pending = ref(false), saving = ref(false), publishing = ref(false), loadError = ref(''), saveError = ref(''),
        active = ref('settings'), pageKey = ref('')
    const deleted = ref(false), deletionError = ref('')
    const detail = ref<WebsiteReleaseDetail | null>(null), detailPending = ref(false), detailError = ref('')
    let recoveryDraft: {
        owner: string;
        key: string;
        id: string;
        record: WebsitePageRecord;
        draft: WebsitePageRecord
    } | null = null
    let owner: string | null = null
    let lifetime = 0, sequence = 0, detailSequence = 0
    const busy = computed(() => saving.value || publishing.value),
        canEdit = computed(() => session.can('content.pages.update') && record.value?.scopeGranted === true),
        canPublish = computed(() => session.can('content.pages.publish') && record.value?.scopeGranted === true)
    const canDelete = computed(() => session.can('content.pages.delete') && record.value?.scopeGranted === true)
    const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(record.value))
    const section = computed(() => (draft.value?.sections??[]).find(s => s.id === active.value))
    const templateUpgrade=computed(()=>{
        const item=section.value,latest=record.value?.templates.find(template=>template.id===item?.templateId)
        return item?.definition&&latest?.definition&&latest.revision&&JSON.stringify(item.definition)!==JSON.stringify(latest.definition)?latest:null
    })

    const assemblyEditor = ref<{kind:'section';name:string;templateId:string;visible:boolean}|null>(null)
    const assemblyEditorError = ref('')
    let assemblyBaseline = ''
    const assemblyEditorDirty = computed(() => !!assemblyEditor.value && JSON.stringify(assemblyEditor.value) !== assemblyBaseline)
    function closeAssemblyEditor() { assemblyEditor.value=null; assemblyEditorError.value=''; assemblyBaseline='' }
    function editAssembly() {
        if (busy.value || !draft.value || active.value !== 'settings') return
        if (!canEdit.value) return
        assemblyEditor.value={kind:'section',name:'',templateId:'',visible:true}
        assemblyBaseline=JSON.stringify(assemblyEditor.value); assemblyEditorError.value=''
    }
    function confirmAssembly() {
        const editor=assemblyEditor.value, page=draft.value
        if (!editor || !page || !canEdit.value || busy.value) return false
        const name=editor.name.trim()
        if(name.length>100){assemblyEditorError.value='请填写区块名称（最多 100 字）。';return false}
        const template=page.templates.find(t=>t.id===editor.templateId)?.definition
        if (!template) {
            assemblyEditorError.value='请选择有效的区块模板。'; return false
        }
        const previous=new Set(page.sections.map(s=>s.id))
        add(editor.templateId)
        const target=page.sections.find(s=>!previous.has(s.id))
        if (!target) { assemblyEditorError.value='该模板已停用或不允许重复添加。'; return false }
        target.name=name||target.name
        target.visible=editor.visible
        closeAssemblyEditor();return true
    }

    function leave(key?: string, id?: string) {
        if (key && (pageKey.value !== key || active.value !== id)) return;
        closeAssemblyEditor();
        lifetime++;
        sequence++;
        detailSequence++;
        deleted.value = false;
        deletionError.value = '';
        record.value = draft.value = null;
        detail.value = null;
        detailPending.value = false;
        detailError.value = '';
        pending.value = saving.value = publishing.value = false;
        loadError.value = saveError.value = ''
    }

    function editableDraft(data:WebsitePageRecord){
        const next=copy(data)
        if(canEdit.value&&active.value!=='settings'){
            const current=next.sections.find(section=>section.id===active.value)
            if(current)initializeSectionDraft(current)
        }
        return next
    }

    async function load() {
        if (deleted.value) return;
        closeAssemblyEditor();
        const seq = ++sequence, life = lifetime, generation = session.generation;
        pending.value = true;
        loadError.value = '';
        try {
            const data = await api.read(pageKey.value);
            if (seq !== sequence || life !== lifetime || generation !== session.generation) return;
            record.value = data;
            draft.value = editableDraft(data);
            saveError.value = ''
        } catch (error) {
            if (seq === sequence && life === lifetime && generation === session.generation) loadError.value = request.message(error)
        } finally {
            if (seq === sequence && life === lifetime && generation === session.generation) pending.value = false
        }
    }

    async function enter(key: string, id = 'settings') {
        const userId = session.currentUser?.id
        const current = record.value
        const reusable = id !== 'settings' && !!userId && owner === userId && pageKey.value === key &&
            !pending.value && !busy.value && !deleted.value && !loadError.value && !recoveryDraft &&
            current && current.sections.some(section => section.id === id)
            ? current : null
        leave();
        pageKey.value = key;
        active.value = id;
        owner = session.currentUser?.id ?? null
        if (reusable) {
            record.value = reusable
            draft.value = editableDraft(reusable)
            return
        }
        if (recoveryDraft && owner === recoveryDraft.owner && key === recoveryDraft.key && id === recoveryDraft.id) {
            const saved = recoveryDraft, life = lifetime, generation = session.generation;
            await load()
            if (life === lifetime && generation === session.generation && pageKey.value === key && active.value === id && record.value?.scopeGranted && session.currentUser?.id === saved.owner) {
                const current = copy(record.value.publication);
                record.value = copy(saved.record);
                draft.value = copy(saved.draft);
                record.value.publication = current;
                draft.value.publication = copy(current);
                recoveryDraft = null
            }
            return
        }
        if (owner && recoveryDraft?.owner !== owner) recoveryDraft = null
        await load()
    }

    function moveTarget(index:number,delta:number){
        return draft.value?sectionMoveTarget(draft.value,index,delta):-1
    }

    function normalizeSections(){
        if(!draft.value)return
        draft.value.sections=normalizeSectionPlacement(draft.value.sections)
    }

    function canMove(index: number, delta: number) {
        return moveTarget(index, delta) >= 0
    }

    function move(index: number, delta: number) {
        if (!canEdit.value || busy.value || !draft.value) return;
        const target = moveTarget(index, delta);
        if (target < 0) return;
        const list = draft.value.sections,current=list[index]!,neighbor=list[target]!;
        [current.sortOrder,neighbor.sortOrder]=[neighbor.sortOrder,current.sortOrder]
        normalizeSections()
    }

    function add(templateId: string) {
        if (!canEdit.value || busy.value || !draft.value) return;
        const t = draft.value.templates.find(t => t.id === templateId);
        if (!t?.enabledForNew || !t.definition) return;
        const page=draft.value
        const section=sectionFromTemplate(t)
        if(!section)return
        section.sortOrder=Math.max(-1,...page.sections.map(item=>item.sortOrder))+1
        page.sections.push(section)
        normalizeSections()
    }

    function remove(id: string) {
        if (!canEdit.value || busy.value || !draft.value) return;
        draft.value.sections = draft.value.sections.filter(s => s.id !== id)
        normalizeSections()
    }

    function setSceneEnabled(enabled:boolean){
        if(!canEdit.value||busy.value||!draft.value)return
        draft.value.settings.sceneEnabled=enabled
        draft.value.settings.sceneTransitionSeconds=enabled?(draft.value.settings.sceneTransitionSeconds??0.42):null
        closeAssemblyEditor()
    }
    const placementIssues=computed(()=>draft.value?.sections.filter(section=>!section.definition).map(section=>section.name)??[])

    async function save(): Promise<AdminActionResult | null> {
        if(active.value==='settings')normalizeSections()
        if (!record.value || !draft.value || !canEdit.value || busy.value || assemblyEditorDirty.value || !dirty.value || active.value === 'settings' && (placementIssues.value.length > 0)) return null
        saving.value = true;
        saveError.value = '';
        const life = lifetime, generation = session.generation
        try {
            let next: WebsitePageRecord
            if (active.value === 'settings') {
                const payload: WebsitePageUpdate = {
                    version: record.value.settingsVersion,
                    settings: draft.value.settings,
                    sections: draft.value.sections.map(s => ({
                        id: s.id,
                        templateId: s.templateId,
                        templateKey: s.templateKey,
                        ...(s.id.startsWith('new_')?{name:s.name}:{}),
                        sortOrder: s.sortOrder,
                        visible: s.visible,
                        anchorKey: s.anchorKey,
                        contentVersion: s.contentVersion,
                        structureVersion: s.structureVersion
                    })),
                    removed: record.value.sections.filter(s => !draft.value!.sections.some(x => x.id === s.id)).map(s => ({
                        id: s.id,
                        contentVersion: s.contentVersion
                    }))
                };
                next = await api.settings(pageKey.value, payload)
            } else {
                const s = section.value;
                if (!s) return null;
                const payload: WebsiteSectionUpdate = {
                    name: s.name.trim(),
                    contentVersion: s.contentVersion,
                    structureVersion: s.structureVersion,

                    shared: s.shared,
                    localized: s.localized,
                };
                next = await api.section(pageKey.value, s.id, payload)
            }
            if (life !== lifetime || generation !== session.generation) return null;
            record.value = next;
            draft.value = editableDraft(next);
            navigation.invalidate();
            return {status: 'success', message: '草稿已保存。'}
        } catch (error) {
            if (life !== lifetime || generation !== session.generation) return null;
            const message = request.operationMessage(error), failure = getAdminRequestFailure(error);
            const detail = message ? ([...new Set(failure?.fields ?? [])].join('；') || message) : '';
            if (failure?.code === 'INVALID_INPUT') { saveError.value = detail; return null }
            return detail ? {status: 'error', message: detail} : null
        } finally {
            if (life === lifetime && generation === session.generation) saving.value = false
        }
    }

    async function publish(releaseId?: string): Promise<AdminActionResult | null> {
        if (!record.value || busy.value || !canPublish.value || (!releaseId && (dirty.value || assemblyEditorDirty.value))) return null
        const r = record.value, life = lifetime, generation = session.generation, input = {
            stateVersion: r.publication.stateVersion,
            version: r.version,
            publishedReleaseId: r.publication.publishedReleaseId
        };
        publishing.value = true;
        saveError.value = ''
        try {
            const next = releaseId ? await releases.restore(r.resourceKey, {
                ...input,
                releaseId
            }) : await releases.publish(r.resourceKey, input);
            if (life !== lifetime || generation !== session.generation) return null;
            r.publication = next;
            if (draft.value) draft.value.publication = copy(next);
            return {status: 'success', message: releaseId ? '已回滚本页发布版本，工作草稿保持不变。搜索索引待更新。' : '本页已发布，搜索索引待更新。'}
        } catch (error) {
            if (life !== lifetime || generation !== session.generation) return null;
            const message = request.operationMessage(error), failure = getAdminRequestFailure(error);
            const detail = message ? ([...new Set(failure?.fields ?? [])].join('；') || message) : '';
            return detail ? {status: 'error', message: detail} : null
        } finally {
            if (life === lifetime && generation === session.generation) publishing.value = false
        }
    }

    // 仅刷新发布元数据，保留页面及区块中的未保存输入。
    async function cleanupRelease(releaseId:string):Promise<AdminActionResult|null>{
        if(!record.value||busy.value||pending.value||!canPublish.value)return null
        const r=record.value,life=lifetime,generation=session.generation
        publishing.value=true
        try{
            await createPublicationHistoryApi(request).cleanup({kind:'website',key:r.resourceKey,releaseId,version:r.version,stateVersion:r.publication.stateVersion,publishedReleaseId:r.publication.publishedReleaseId})
            const next=await releases.history(r.resourceKey)
            if(life!==lifetime||generation!==session.generation)return null
            r.publication=next
            if(draft.value)draft.value.publication=copy(next)
            return {status:'success',message:'历史发布已清理，图片文件保留在媒体库。'}
        }catch(error){
            if(life!==lifetime||generation!==session.generation)return null
            const failure=getAdminRequestFailure(error),message=request.operationMessage(error)
            return message?{status:'error',message:failure?.fields?.join('；')||message}:null
        }finally{if(life===lifetime&&generation===session.generation)publishing.value=false}
    }

    async function withdraw(): Promise<AdminActionResult | null> {
        if (!record.value || busy.value || dirty.value || assemblyEditorDirty.value || !record.value.persisted) return null
        const status = record.value.publication.status
        if (status !== 'published') return null
        if (!canPublish.value) return null
        const r = record.value, life = lifetime, generation = session.generation;
        publishing.value = true;
        saveError.value = ''
        try {
            const next = await releases.withdraw(r.resourceKey, {
                version: r.version,
                stateVersion: r.publication.stateVersion,
                publishedReleaseId: r.publication.publishedReleaseId
            });
            if (life !== lifetime || generation !== session.generation) return null;
            r.publication = next;
            if (draft.value) draft.value.publication = copy(next);
            navigation.invalidate();
            return {status: 'success', message: '页面已下线，草稿和发布历史已保留。搜索索引待更新。'}
        } catch (error) {
            if (life !== lifetime || generation !== session.generation) return null;
            const message = request.operationMessage(error), failure = getAdminRequestFailure(error);
            const detail = message ? ([...new Set(failure?.fields ?? [])].join('；') || message) : '';
            return detail ? {status: 'error', message: detail} : null
        } finally {
            if (life === lifetime && generation === session.generation) publishing.value = false
        }
    }

    function clearDeletionError() {
        if (!busy.value) deletionError.value = ''
    }

    async function permanentlyRemove(confirmation: string): Promise<AdminActionResult | null> {
        if (!record.value || !canDelete.value || busy.value || dirty.value || assemblyEditorDirty.value || active.value !== 'settings' || record.value.publication.publishedReleaseId) return null
        deletionError.value = ''
        if (confirmation.trim() !== record.value.key) {
            deletionError.value = '请输入正确的页面编码。';
            return null
        }
        const r = record.value, life = lifetime, generation = session.generation;
        publishing.value = true
        try {
            await api.remove(r.key, {
                resourceId: r.resourceId,
                version: r.version,
                stateVersion: r.publication.stateVersion,
                publishedReleaseId: null,
                confirmation: confirmation.trim()
            });
            if (life !== lifetime || generation !== session.generation) return null;
            recoveryDraft = null;
            leave();
            deleted.value = true;
            navigation.invalidate();
            return {status: 'success', message: '页面及发布历史已永久删除。'}
        } catch (error) {
            if (life !== lifetime || generation !== session.generation) return null;
            const message = request.operationMessage(error), failure = getAdminRequestFailure(error);
            const detail = message ? ([...new Set(failure?.fields ?? [])].join('；') || message) : '';
            return detail ? {status: 'error', message: detail} : null
        } finally {
            if (life === lifetime && generation === session.generation) publishing.value = false
        }
    }

    async function upgradeTemplate():Promise<AdminActionResult|null>{
        const item=section.value,latest=templateUpgrade.value
        if(!item||!latest?.revision||busy.value||pending.value||dirty.value||!canEdit.value)return null
        const life=lifetime,generation=session.generation
        saving.value=true
        try{
            const next=await api.upgrade(pageKey.value,item.id,{contentVersion:item.contentVersion,structureVersion:item.structureVersion,revision:latest.revision})
            if(life!==lifetime||generation!==session.generation)return null
            record.value=next;draft.value=copy(next)
            return {status:'success',message:'区块草稿已升级模板修订，重新发布页面后官网生效。'}
        }catch(error){
            if(life!==lifetime||generation!==session.generation)return null
            const message=request.operationMessage(error),failure=getAdminRequestFailure(error)
            return message?{status:'error',message:failure?.fields?.join('；')||message}:null
        }finally{if(life===lifetime&&generation===session.generation)saving.value=false}
    }

    function closeDetail() {
        detailSequence++;
        detail.value = null;
        detailPending.value = false;
        detailError.value = ''
    }

    async function loadDetail(id: string) {
        const seq = ++detailSequence, life = lifetime, generation = session.generation;
        detail.value = null;
        detailError.value = '';
        detailPending.value = true;
        try {
            const next = await releases.detail(`page.${pageKey.value}`, id);
            if (seq === detailSequence && life === lifetime && generation === session.generation) detail.value = next
        } catch (error) {
            if (seq === detailSequence && life === lifetime && generation === session.generation) detailError.value = request.message(error)
        } finally {
            if (seq === detailSequence && life === lifetime && generation === session.generation) detailPending.value = false
        }
    }

    watch(() => session.generation, () => {
        const reason = session.transition
        if ((reason === 'expired' || reason === 'password-change') && owner && dirty.value && record.value && draft.value) recoveryDraft = {
            owner,
            key: pageKey.value,
            id: active.value,
            record: copy(record.value),
            draft: copy(draft.value)
        }
        else if (reason !== 'login' && reason !== 'expired' && reason !== 'password-change') recoveryDraft = null
        leave()
    }, {flush: 'sync'})
    watch(() => session.currentUser?.id, id => {
        if (id && recoveryDraft && id !== recoveryDraft.owner) recoveryDraft = null
    }, {flush: 'sync'})
    return {
        record,
        draft,
        section,
        active,
        pending,
        busy,
        saving,
        publishing,
        loadError,
        saveError,
        dirty,
        canEdit,
        canPublish,
        canDelete,
        deleted,
        deletionError,
        clearDeletionError,
        permanentlyRemove,
        withdraw,
        detail,
        detailPending,
        detailError,
        enter,
        leave,
        load,
        save,
        publish,
        cleanupRelease,
        templateUpgrade,
        upgradeTemplate,
        move,
        canMove,
        setSceneEnabled,
        placementIssues,
        assemblyEditor, assemblyEditorError, assemblyEditorDirty, editAssembly, confirmAssembly, closeAssemblyEditor,
        add,
        remove,
        loadDetail,
        closeDetail
    }
})
