import {emptyLocalizedText} from '#shared/utils/localized'
import {computed, ref, watch} from 'vue'
import {defineStore} from 'pinia'
import {inquiryCategoryDraftSchema, inquirySettingsUpdateSchema, type InquirySettings, type InquirySettingsView} from '#shared/schemas/admin/inquiry-settings'
import {type SiteLocale} from '#shared/schemas/admin/site-settings'
import type {AdminOperationResult} from '~/types/admin/action-result'
import {createInquirySettingsApi} from '~/api/admin/inquiry-settings'
import {getAdminRequestFailure} from '~/utils/admin/request/errors'
import {useAdminRequestStore} from './request'
import {useAdminSessionStore} from './session'

export const useAdminInquirySettingsStore = defineStore('admin-inquiry-settings', () => {
    const request = useAdminRequestStore(), api = createInquirySettingsApi(request), session = useAdminSessionStore()
    const draft = ref<InquirySettingsView | null>(null), original = ref(''), pending = ref(true), busy = ref(false)
    const loadError = ref(''), error = ref('')
    const selected = ref(-1), existing = ref<string[]>([])
    const editing = ref<InquirySettings['categories'][number] | null>(null), editorBaseline = ref('')
    const editorError = ref('')
    const forwardMode = ref<'notice' | 'details'>('details')
    const editingTemplate = computed(() => draft.value?.settings.mail.forwardTemplates[forwardMode.value])
    const codeLocked = computed(() => selected.value >= 0 && existing.value.includes(draft.value?.settings.categories[selected.value]?.code ?? ''))
    const dirty = computed(() => !!draft.value && JSON.stringify(draft.value.settings) !== original.value)
    const editorDirty = computed(() => !!editing.value && JSON.stringify(editing.value) !== editorBaseline.value)
    const canRead = computed(() => session.can('content.inquiries.settings'))
    const identity = computed(() => session.generation)
    let revision = 0

    function accept(value: InquirySettingsView) {
        if (!draft.value) forwardMode.value = value.settings.mail.forwardContent
        draft.value = value
        existing.value = value.settings.categories.map(item => item.code)
        original.value = JSON.stringify(value.settings)
    }

    async function load() {
        const current = ++revision
        pending.value = true; loadError.value = ''; error.value = ''
        try {
            const value = await api.get()
            if (current !== revision) return false
            accept(value)
            return true
        } catch (cause) {
            if (current === revision) loadError.value = request.message(cause)
            return false
        } finally {
            if (current === revision) pending.value = false
        }
    }

    function addCategory() {
        if (!draft.value || draft.value.settings.categories.length >= 50) return
        selected.value = -1
        editorError.value = ''
        editing.value = {code:'', labels:emptyLocalizedText(), enabled:true, forwardTo:'', defaultAssigneeId:''}
        editorBaseline.value = JSON.stringify(editing.value)
    }

    function editCategory(index: number) {
        const item = draft.value?.settings.categories[index]
        if (!item) return
        selected.value = index
        editorError.value = ''
        editing.value = {...item, labels:{...item.labels}}
        editorBaseline.value = JSON.stringify(editing.value)
    }

    function closeEditor() {
        editing.value = null; selected.value = -1; editorBaseline.value = ''; editorError.value = ''
    }

    function applyCategory(locale: SiteLocale) {
        if (!draft.value || !editing.value || busy.value) return
        const parsed = inquiryCategoryDraftSchema.safeParse(editing.value)
        if (!parsed.success) {
            const field = parsed.error.issues[0]?.path[0]
            editorError.value = field === 'code' ? '请检查类型代码。' : field === 'labels' ? '名称不能换行或超过 80 个字符。'
                : field === 'forwardTo' ? '请检查类型团队邮箱的格式。' : '请检查咨询类型的设置。'
            return
        }
        if (!parsed.data.labels[locale]) {
            editorError.value = '请填写当前语言的名称。'
            return
        }
        const categories = draft.value.settings.categories
        if (categories.some((item, index) => index !== selected.value && item.code === parsed.data.code)) {
            editorError.value = '咨询类型代码不能重复。'
            return
        }
        if (selected.value < 0) categories.push(parsed.data)
        else categories[selected.value] = parsed.data
        closeEditor()
    }

    function setEnabled(index: number, enabled: boolean) {
        const item = draft.value?.settings.categories[index]
        if (item) item.enabled = enabled
    }

    function move(index: number, direction: number) {
        const items = draft.value?.settings.categories, target = index + direction
        if (!items?.[index] || !items[target]) return
        const [item] = items.splice(index, 1)
        if (item) items.splice(target, 0, item)
    }

    function remove(index: number) {
        draft.value?.settings.categories.splice(index, 1)
    }

    function restoreForwardTemplate() {
        if (draft.value) draft.value.settings.mail.forwardTemplates[forwardMode.value] = {...draft.value.forwardTemplateDefaults[forwardMode.value]}
    }

    async function save(): Promise<AdminOperationResult | null> {
        if (!draft.value || editing.value || busy.value || pending.value || !dirty.value || !canRead.value) return null
        error.value = ''
        const {version, settings} = draft.value
        const input = inquirySettingsUpdateSchema.safeParse({version, settings})
        if (!input.success) {
            const issue = input.error.issues[0]
            error.value = issue?.code === 'custom' && issue.message !== 'Invalid input'
                ? issue.message : '请检查类型代码、名称、邮箱格式和邮件文案。'
            return null
        }
        const current = revision
        busy.value = true
        try {
            const value = await api.save(input.data)
            if (current !== revision) return null
            accept(value)
            return {message:'咨询设置已保存。', status:'success'}
        } catch (cause) {
            if (current !== revision) return null
            const message = request.operationMessage(cause)
            if (message) error.value = getAdminRequestFailure(cause)?.fields?.[0] || message
            return null
        } finally {
            if (current === revision) busy.value = false
        }
    }

    function leave() {
        revision++
        draft.value = null; original.value = ''; existing.value = []
        pending.value = true; busy.value = false; loadError.value = ''; error.value = ''
        closeEditor()
    }
    watch([identity, canRead], leave, {flush:'sync'})

    return {draft, pending, busy, loadError, error, selected, editing, dirty, editorDirty, editorError, codeLocked, forwardMode, editingTemplate,
        identity, canRead, load, leave, addCategory, editCategory, closeEditor, applyCategory, setEnabled, move, remove, restoreForwardTemplate, save}
})
