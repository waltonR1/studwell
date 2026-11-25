import {computed, ref, watch} from 'vue'
import {defineStore} from 'pinia'
import {createWebsiteTemplatesApi} from '~/api/admin/website-templates'
import {useAdminRequestStore} from './request'
import {useAdminSessionStore} from './session'
import type {WebsiteTemplateCatalogRecord} from '#shared/types/admin/website'
import type {AdminActionResult} from '~/types/admin/action-result'
import type {TemplateConfigurationDraft} from '~/types/admin/template-configuration'
import {sectionTemplateRevisionSchema} from '#shared/schemas/admin/section-template'
import {getAdminRequestFailure} from '~/utils/admin/request/errors'

export const useAdminWebsiteTemplatesStore = defineStore('admin-website-templates', () => {
    const request = useAdminRequestStore(), session = useAdminSessionStore(), api = createWebsiteTemplatesApi(request),
        items = ref<WebsiteTemplateCatalogRecord[]>([]), pending = ref(false), saving = ref(false), error = ref(''),
        saveError = ref(''), draft = ref<WebsiteTemplateCatalogRecord | null>(null)
    let sequence = 0
    const configuration=ref<TemplateConfigurationDraft|null>(null),configurationError=ref('')
    let configurationBaseline=''
    const configurationDirty=computed(()=>!!configuration.value&&JSON.stringify(configuration.value)!==configurationBaseline)
    const dirty = computed(() => draft.value && JSON.stringify(draft.value) !== JSON.stringify(items.value.find(i => i.id === draft.value?.id)))

    function leave() {
        sequence++;
        items.value = [];
        draft.value = null;
        configuration.value=null;configurationError.value='';configurationBaseline=''
        pending.value = saving.value = false;
        error.value = saveError.value = ''
    }

    async function load() {
        const seq = ++sequence, generation = session.generation;
        pending.value = true;
        error.value = '';
        try {
            const next = await api.read();
            if (seq === sequence && generation === session.generation) items.value = next
        } catch (e) {
            if (seq === sequence && generation === session.generation) error.value = request.message(e)
        } finally {
            if (seq === sequence && generation === session.generation) pending.value = false
        }
    }

    function edit(id: string) {
        const item = items.value.find(i => i.id === id);
        if (!saving.value && !configuration.value && item) {
            draft.value = JSON.parse(JSON.stringify(item));
            saveError.value = ''
        }
    }

    function configure(id?:string){
        if(saving.value||pending.value||draft.value||configuration.value||!session.can('content.templates.update'))return
        const item=id?items.value.find(item=>item.id===id):undefined
        if(id&&!item?.definition)return
        configuration.value={id:item?.id??null,version:item?.metadataVersion??1,revision:item?.revision??1,definition:item?.definition?JSON.parse(JSON.stringify(item.definition)):null,publicComponentPath:'',previewComponentPath:'',description:item?.description??''}
        configurationError.value='';configurationBaseline=JSON.stringify(configuration.value)
    }
    function closeConfiguration(){if(!saving.value){configuration.value=null;configurationError.value=''}}
    function importDefinition(text:string){
        if(!configuration.value||configuration.value.id||saving.value)return
        configurationError.value=''
        try{
            if(text.length>1000000)throw new Error('定义文件不能超过 1 MB。')
            const result=sectionTemplateRevisionSchema.safeParse(JSON.parse(text))
            if(!result.success)throw new Error(result.error.issues.map(issue=>issue.path.join('.')+'：'+issue.message).slice(0,8).join('；'))
            configuration.value.definition=result.data
        }catch(error){configurationError.value=error instanceof Error?error.message:'模板定义无效。'}
    }
    async function saveConfiguration():Promise<AdminActionResult|null>{
        const value=configuration.value
        if(!value?.definition||saving.value||pending.value||!session.can('content.templates.update'))return null
        const seq=sequence,generation=session.generation
        saving.value=true;configurationError.value=''
        try{
            const next=value.id?await api.revise(value.id,{version:value.version,revision:value.revision,definition:value.definition}):await api.register({definition:value.definition,publicComponentPath:value.publicComponentPath.trim(),previewComponentPath:value.previewComponentPath.trim()||value.publicComponentPath.trim(),description:value.description})
            if(seq!==sequence||generation!==session.generation)return null
            items.value=next;configuration.value=null
            return {status:'success',message:value.id?'配置已保存为新修订，已有区块保持原修订。':'模板已登记，确认配置后可在列表启用。'}
        }catch(error){
            if(seq!==sequence||generation!==session.generation)return null
            const message=request.operationMessage(error),failure=getAdminRequestFailure(error)
            configurationError.value=message?(failure?.fields?.join('；')||message):''
            return null
        }finally{if(seq===sequence&&generation===session.generation)saving.value=false}
    }

    function close() {
        if (!saving.value) {
            draft.value = null;
            saveError.value = ''
        }
    }

    async function persist(d: WebsiteTemplateCatalogRecord, mode: 'edit' | 'status'): Promise<AdminActionResult | null> {
        if (saving.value || pending.value || configuration.value || !session.can('content.templates.update')) return null
        const seq = sequence, generation = session.generation
        saving.value = true
        saveError.value = ''
        try {
            const next = await api.update(d.id, {
                version: d.metadataVersion,
                coverMediaId: d.coverMediaId,
                name: d.name,
                description: d.description,
                enabledForNew: d.enabledForNew
            })
            if (seq !== sequence || generation !== session.generation) return null
            items.value = next
            if (mode === 'edit') draft.value = null
            return {status: 'success', message: mode === 'edit' ? '模板资料已保存。' : d.enabledForNew ? '模板已启用。' : '模板已禁用。'}
        } catch (e) {
            if (seq !== sequence || generation !== session.generation) return null
            const message = request.operationMessage(e)
            if (mode === 'edit') saveError.value = message
            else if (message) return {status: 'error', message}
            return null
        } finally {
            if (seq === sequence && generation === session.generation) saving.value = false
        }
    }

    async function save() {
        return draft.value ? persist(draft.value, 'edit') : null
    }

    async function setEnabled(id: string, value: boolean) {
        const item = items.value.find(item => item.id === id)
        if (!item || draft.value || item.enabledForNew === value || (value && !item.definition)) return null
        return persist({...item, enabledForNew: value}, 'status')
    }

    async function remove(id: string): Promise<AdminActionResult | null> {
        const item = items.value.find(candidate => candidate.id === id)
        if (!item || saving.value || pending.value || draft.value || configuration.value || !session.can('content.templates.update')) return null
        if (item.enabledForNew) return {status: 'error', message: '请先禁用模板，再删除。'}
        const seq = sequence, generation = session.generation
        saving.value = true
        saveError.value = ''
        try {
            const next = await api.remove(id, {version: item.metadataVersion})
            if (seq !== sequence || generation !== session.generation) return null
            items.value = next
            return {status: 'success', message: '模板已删除，其他内容保持不变。'}
        } catch (e) {
            if (seq !== sequence || generation !== session.generation) return null
            const message = request.operationMessage(e)
            return message ? {status: 'error', message} : null
        } finally {
            if (seq === sequence && generation === session.generation) saving.value = false
        }
    }

    watch(() => session.generation, leave)
    return {items, pending, saving, error, saveError, draft, dirty, load, leave, edit, close, save, setEnabled, remove,configuration,configurationError,configurationDirty,configure,closeConfiguration,importDefinition,saveConfiguration}
})
