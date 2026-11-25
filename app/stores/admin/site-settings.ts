import {sameLinkTarget} from '#shared/utils/website/link-target'
import {computed, ref, watch} from 'vue'
import {defineStore} from 'pinia'
import {createWebsiteResourcesApi} from '~/api/admin/website-resources'
import {createPublicationHistoryApi} from '~/api/admin/publication-history'
import {createSiteSettingsApi} from '~/api/admin/site-settings'
import {useAdminRequestStore} from './request'
import {useAdminSessionStore} from './session'
import {createSiteSettings,createSiteLink} from '#shared/utils/admin/site-settings'
import {siteSectionNames,siteFieldNames} from '#shared/config/admin/site-settings'
import {
    siteSections,
    siteSettingsUpdateSchema,
    siteLinkSchema,
    type SiteSection,
    type SiteSettings,
    type SiteLink,
    type SiteLocale
} from '#shared/schemas/admin/site-settings'
import type {SiteSettingsRecord, SiteReleaseDetail} from '#shared/types/admin/site-settings'
import {applyNavigationEdit, type NavigationEdit} from '~/utils/admin/site-settings/navigation'
import {getAdminRequestFailure} from '~/utils/admin/request/errors'
import type {AdminActionResult} from '~/types/admin/action-result'

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value))
export const useAdminSiteSettingsStore = defineStore('admin-site-settings', () => {
    const request = useAdminRequestStore(), session = useAdminSessionStore(), api = createSiteSettingsApi(request),
        publishingApi = createWebsiteResourcesApi(request)
    const activeSection = ref<SiteSection | null>(null)
    const draft = ref(createSiteSettings()), record = ref<SiteSettingsRecord | null>(null)
    const pending = ref(false), saving = ref(false), publishing = ref(false), loadError = ref(''), saveError = ref('')
    const releaseDetail = ref<SiteReleaseDetail | null>(null), detailPending = ref(false), detailError = ref(''),
        detailId = ref<string | null>(null)
    const dirtySections = computed(() => siteSections.filter(section => record.value && JSON.stringify(draft.value[section]) !== JSON.stringify(record.value.content[section])))
    const dirty = computed(() => dirtySections.value.length > 0)
    const canEdit = computed(() => session.can('content.site_settings.update'))
    const canPublish = computed(() => session.can('content.site_settings.publish'))
    const busy = computed(() => saving.value || publishing.value)
    const navigationEditor = ref<(NavigationEdit & { original: string }) | null>(null), editorError = ref('')
    const editorState = () => navigationEditor.value ? JSON.stringify({
        value: navigationEditor.value.value,
        parent: navigationEditor.value.parent,
        kind: navigationEditor.value.kind
    }) : ''
    const editorDirty = computed(() => !!navigationEditor.value && editorState() !== navigationEditor.value.original)
    const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`

    function editLink(scope: 'header' | 'child' | 'footer', index = -1, owner = 0) {
        if (busy.value || index < 0 && !canEdit.value) return
        const list = scope === 'header' ? draft.value.header.items : scope === 'child' ? draft.value.header.items[owner]?.children ?? [] : draft.value.footer.groups[owner]?.items ?? []
        const existing = index < 0 ? undefined : list[index]
        const value: SiteLink = existing ? {
            id: existing.id,
            label: copy(existing.label),
            target: copy(existing.target),
            visible: existing.visible
        } : createSiteLink(newId('link'))
        const parent = scope === 'header' ? '' : scope === 'child' ? draft.value.header.items[owner]?.id ?? '' : draft.value.footer.groups[owner]?.id ?? ''
        navigationEditor.value = {scope, index, owner, kind: 'link', parent, value, original: ''}
        navigationEditor.value.original = editorState();
        editorError.value = ''
    }

    function editGroup(index = -1) {
        if (busy.value || index < 0 && !canEdit.value) return
        const existing = draft.value.footer.groups[index], value = createSiteLink(existing?.id ?? newId('group'))
        if (existing) {
            value.label = copy(existing.title);
            value.visible = existing.visible
        }
        navigationEditor.value = {scope: 'group', index, owner: 0, kind: 'group', parent: '', value, original: ''}
        navigationEditor.value.original = editorState();
        editorError.value = ''
    }

    function changeNodeKind(kind: string) {
        if (!navigationEditor.value || !canEdit.value || busy.value) return
        navigationEditor.value.kind = kind as 'link' | 'group'
        navigationEditor.value.parent = kind === 'group' ? '' : draft.value.footer.groups[0]?.id ?? ''
    }

    function closeEditor() {
        navigationEditor.value = null;
        editorError.value = ''
    }

    function confirmNavigation(locale: SiteLocale) {
        const editor = navigationEditor.value
        if (!editor || !canEdit.value || busy.value) return
        if (editor.kind === 'group' && !editor.value.label[locale]?.trim()) {
            editorError.value = '请输入分组名称。';
            return
        }
        const selected = editor.value.target
        const target = !('resourceId' in selected) || record.value?.targets.some(({target}) => sameLinkTarget(target,selected))
        if (editor.kind === 'link' && (!siteLinkSchema.safeParse(editor.value).success || !target)) {
            editorError.value = '请选择有效的链接目标，并检查显示名称。';
            return
        }
        try {
            const next = applyNavigationEdit(copy(draft.value.header), copy(draft.value.footer), copy(editor))
            if (editor.scope === 'header' || editor.scope === 'child') draft.value.header = next.header
            else draft.value.footer = next.footer
            closeEditor()
        } catch (error) {
            editorError.value = error instanceof Error ? error.message : '无法调整导航，请检查后重试。'
        }
    }

    function moveNavigation(list: unknown[], index: number, delta: number) {
        if (!canEdit.value || busy.value || index + delta < 0 || index + delta >= list.length) return
        list.splice(index + delta, 0, list.splice(index, 1)[0])
    }

    function removeNavigation(list: unknown[], index: number) {
        if (canEdit.value && !busy.value) list.splice(index, 1)
    }

    function setNavigationVisible(list:unknown[],index:number,value:boolean){
        if(!canEdit.value||busy.value)return
        const owned:unknown[][]=[draft.value.header.items,...draft.value.header.items.map(item=>item.children),draft.value.footer.groups,...draft.value.footer.groups.map(group=>group.items)]
        if(!owned.includes(list))return
        const item=list[index] as {visible?:unknown}|undefined
        if(item&&typeof item.visible==='boolean')item.visible=value
    }

    let sequence = 0, lifetime = 0, detailSequence = 0

    function closeDetail(id?: string) {
        if (id && detailId.value !== id) return
        detailSequence++;
        detailId.value = null;
        releaseDetail.value = null;
        detailPending.value = false;
        detailError.value = ''
    }

    function leave(section?: SiteSection) {
        if (section && activeSection.value !== section) return
        sequence++;
        lifetime++;
        closeDetail();
        closeEditor();
        activeSection.value = null
        record.value = null;
        draft.value = createSiteSettings();
        pending.value = saving.value = publishing.value = false
        loadError.value = saveError.value = ''
    }

    async function load() {
        const current = ++sequence, generation = session.generation, revision = lifetime
        pending.value = true;
        loadError.value = ''
        try {
            const next = await api.read()
            if (current !== sequence || generation !== session.generation || revision !== lifetime) return
            record.value = next;
            draft.value = copy(next.content);
            saveError.value = ''
        } catch (error) {
            if (current === sequence && generation === session.generation && revision === lifetime) loadError.value = request.message(error)
        } finally {
            if (current === sequence && generation === session.generation && revision === lifetime) pending.value = false
        }
    }

    async function enter(section: SiteSection) {
        leave();
        activeSection.value = section;
        await load()
    }

    async function save(section: SiteSection): Promise<AdminActionResult | null> {
        if (busy.value || pending.value || !canEdit.value || !record.value || !dirtySections.value.includes(section)) return null
        saveError.value = ''
        const parsed = siteSettingsUpdateSchema.safeParse({
            section,
            version: record.value.versions[section],
            content: draft.value[section]
        })
        if (!parsed.success) {
            const issue = parsed.error.issues[0]!, field = String(issue.path[1] ?? '')
            saveError.value = `${siteFieldNames[field] ?? siteSectionNames[section]}：${/[\u4e00-\u9fff]/.test(issue.message) ? issue.message : '请检查输入内容。'}`
            return null
        }
        const generation = session.generation, revision = lifetime, original = copy(record.value),
            keep = [...dirtySections.value]
        saving.value = true
        try {
            const next = await api.update(parsed.data)
            if (generation !== session.generation || revision !== lifetime) return null
            let nextDraft: SiteSettings = copy(draft.value)
            for (const key of siteSections) {
                if (key !== section && keep.includes(key)) {
                    next.content = {...next.content, [key]: original.content[key]};
                    next.versions[key] = original.versions[key]
                } else nextDraft = {...nextDraft, [key]: copy(next.content[key])}
            }
            record.value = next;
            draft.value = nextDraft
            return {message: `${siteSectionNames[section]}已保存。`, status: 'success'}
        } catch (error) {
            if (generation !== session.generation || revision !== lifetime) return null;
            const message = request.operationMessage(error), failure = getAdminRequestFailure(error);
            const detail = message ? ([...new Set(failure?.fields ?? [])].join('；') || message) : '';
            if (failure?.code === 'INVALID_INPUT') { saveError.value = detail; return null }
            return detail ? {status: 'error', message: detail} : null
        } finally {
            if (generation === session.generation && revision === lifetime) saving.value = false
        }
    }

    async function publish(section: SiteSection, releaseId?: string): Promise<AdminActionResult | null> {
        const publication = record.value?.publication?.[section]
        if (busy.value || pending.value || !canPublish.value || !publication || (!releaseId && (dirtySections.value.includes(section) || editorDirty.value))) return null
        const generation = session.generation, revision = lifetime
        publishing.value = true
        saveError.value = ''
        const input = {
            stateVersion: publication.stateVersion,
            version: publication.draftVersion,
            publishedReleaseId: publication.publishedReleaseId
        }
        try {
            const next = releaseId ? await publishingApi.restore(`site.${section}`, {
                ...input,
                releaseId
            }) : await publishingApi.publish(`site.${section}`, input)
            if (generation !== session.generation || revision !== lifetime) return null
            if (record.value?.publication) record.value.publication[section] = {
                ...next,
                changedSections: next.changed ? [section] : []
            }
            return {message: releaseId ? '已恢复历史发布版本。' : `${siteSectionNames[section]}已发布。`, status: 'success'}
        } catch (error) {
            if (generation !== session.generation || revision !== lifetime) return null
            const message = request.operationMessage(error), failure = getAdminRequestFailure(error);
            const detail = message ? ([...new Set(failure?.fields ?? [])].join('；') || message) : '';
            return detail ? {message: detail, status: 'error'} : null
        } finally {
            if (generation === session.generation && revision === lifetime) publishing.value = false
        }
    }

    // 清理不重新装载草稿，避免覆盖尚未保存的标识或导航。
    async function cleanupRelease(section:SiteSection,releaseId:string):Promise<AdminActionResult|null>{
        const publication=record.value?.publication?.[section]
        if(!publication||busy.value||pending.value||!canPublish.value)return null
        const generation=session.generation,revision=lifetime
        publishing.value=true
        try{
            await createPublicationHistoryApi(request).cleanup({kind:'website',key:`site.${section}`,releaseId,version:publication.draftVersion,stateVersion:publication.stateVersion,publishedReleaseId:publication.publishedReleaseId})
            const next=await publishingApi.history(`site.${section}`)
            if(generation!==session.generation||revision!==lifetime)return null
            if(record.value?.publication)record.value.publication[section]={...next,changedSections:next.changed?[section]:[]}
            return {status:'success',message:'历史发布已清理，图片文件保留在媒体库。'}
        }catch(error){
            if(generation!==session.generation||revision!==lifetime)return null
            const failure=getAdminRequestFailure(error),message=request.operationMessage(error)
            return message?{status:'error',message:failure?.fields?.join('；')||message}:null
        }finally{if(generation===session.generation&&revision===lifetime)publishing.value=false}
    }

    async function loadDetail(section: SiteSection, id: string) {
        const current = ++detailSequence, generation = session.generation, revision = lifetime
        detailId.value = id;
        detailPending.value = true;
        detailError.value = '';
        releaseDetail.value = null
        try {
            const result = await publishingApi.detail(`site.${section}`, id)
            if (current === detailSequence && generation === session.generation && revision === lifetime) releaseDetail.value = {
                ...result,
                section,
                content: {[section]: result.content}
            }
        } catch (error) {
            if (current === detailSequence && generation === session.generation && revision === lifetime) detailError.value = request.message(error)
        } finally {
            if (current === detailSequence && generation === session.generation && revision === lifetime) detailPending.value = false
        }
    }

    watch(() => session.generation, () => leave())
    return {
        navigationEditor,
        editorError,
        editorDirty,
        editLink,
        editGroup,
        changeNodeKind,
        closeEditor,
        confirmNavigation,
        moveNavigation,
        removeNavigation,
        setNavigationVisible,
        activeSection,
        draft,
        record,
        pending,
        saving,
        publishing,
        busy,
        loadError,
        saveError,
        dirtySections,
        dirty,
        canEdit,
        canPublish,
        releaseDetail,
        detailPending,
        detailError,
        enter,
        leave,
        load,
        save,
        publish,
        cleanupRelease,
        loadDetail,
        closeDetail
    }
})
