import type {AdminOperationResult} from '~/types/admin/action-result'
// 后台字典类型列表、详情共享版本、类型草稿和选项草稿的生命周期。
import {computed, reactive, watch} from 'vue'
import {defineStore} from 'pinia'
import type {AdminDictionaryQuery} from '~/types/admin/dictionaries'
import type {PageData} from '#shared/types/api'
import type {DictionaryDetail, DictionaryItem, DictionaryRecord, } from '#shared/types/admin/dictionaries'
import {
    dictionaryCreateSchema,
    dictionaryFieldsSchema,
    dictionaryCodeSchema,
    dictionaryItemFieldsSchema,
} from '#shared/schemas/admin/dictionaries'
import {createDictionariesApi} from '~/api/admin/dictionaries'
import {useAdminRequestStore} from '~/stores/admin/request'
import {useAdminSessionStore} from './session'


const emptyTypeForm = () => ({
    code: '',
    name: '',
    description: '',
    enabled: true,
})
const emptyTypeTouched = () => ({
    code: false,
    name: false,
    description: false,
})
const emptyItemForm = () => ({
    code: '',
    name: '',
    sortOrder: 0,
    enabled: true,
})
const emptyItemTouched = () => ({
    code: false,
    name: false,
    sortOrder: false,
})

export const useAdminDictionariesStore = defineStore('admin-dictionaries', () => {
    const session = useAdminSessionStore()
    const api = useAdminRequestStore()
    const requests = createDictionariesApi(api)

    const list = reactive({
        data: null as PageData<DictionaryRecord> | null,
        pending: false,
        error: '',
        stale: true,
        query: {} as AdminDictionaryQuery,
        feedback: null as AdminOperationResult | null,
    })
    const editor = reactive({
        open: false,
        dictionaryId: null as string | null,
        detail: null as DictionaryDetail | null,
        loading: false,
        loadError: '',
        busy: false,
        typeError: '',
        feedback: null as AdminOperationResult | null,
        typeForm: emptyTypeForm(),
        typeTouched: emptyTypeTouched(),
        itemSearch: '',
        itemStatus: '',
        itemPage: 1,
        itemPageSize: '20',
        itemEditorOpen: false,
        editingItem: null as DictionaryItem | null,
        itemError: '',
        itemForm: emptyItemForm(),
        itemTouched: emptyItemTouched(),
    })

    let listSequence = 0
    let loadSequence = 0
    let writeRevision = 0
    let listPromise: Promise<void> | null = null

    const canCreateType = computed(() => session.can('system.dictionaries.create'))
    const canUpdateType = computed(() => session.can('system.dictionaries.update'))
    const canCreateItem = computed(() => session.can('system.dictionaries.items.create'))
    const canUpdateItem = computed(() => session.can('system.dictionaries.items.update'))
    const createMode = computed(() => !editor.detail)
    const typeEditable = computed(() =>
        createMode.value ? canCreateType.value : canUpdateType.value,
    )
    const dialogTitle = computed(() =>
        editor.detail || editor.dictionaryId ? '编辑字典' : '新增字典',
    )
    const typeParsed = computed(() =>
        createMode.value
            ? dictionaryCreateSchema.safeParse(editor.typeForm)
            : dictionaryFieldsSchema.safeParse({
                name: editor.typeForm.name,
                description: editor.typeForm.description,
                enabled: editor.typeForm.enabled,
            }),
    )
    const fieldErrors = computed<Record<string, string>>(() =>
        typeParsed.value.success
            ? {}
            : Object.fromEntries(typeParsed.value.error.issues
                .filter(issue =>
                    editor.typeTouched[issue.path[0] as keyof typeof editor.typeTouched],
                )
                .map(issue => [String(issue.path[0]), issue.message])),
    )
    const metadataDirty = computed(() => editor.detail
        ? editor.typeForm.name !== editor.detail.name
            || editor.typeForm.description !== editor.detail.description
            || editor.typeForm.enabled !== editor.detail.enabled
        : !!editor.typeForm.code
            || !!editor.typeForm.name
            || !!editor.typeForm.description
            || !editor.typeForm.enabled,
    )
    const filteredItems = computed(() => {
        const keyword = editor.itemSearch.trim().toLowerCase()
        return (editor.detail?.items ?? []).filter(item =>
            (!keyword || `${item.name} ${item.code}`.toLowerCase().includes(keyword))
            && (
                !editor.itemStatus
                || item.enabled === (editor.itemStatus === 'enabled')
            ),
        )
    })
    const itemPages = computed(() =>
        Math.max(1, Math.ceil(filteredItems.value.length / Number(editor.itemPageSize))),
    )
    const pagedItems = computed(() =>
        filteredItems.value.slice(
            (editor.itemPage - 1) * Number(editor.itemPageSize),
            editor.itemPage * Number(editor.itemPageSize),
        ),
    )
    const writableItem = computed(() =>
        editor.editingItem ? canUpdateItem.value : canCreateItem.value,
    )
    const itemDirty = computed(() => editor.editingItem
        ? editor.itemForm.name !== editor.editingItem.name
            || editor.itemForm.sortOrder !== editor.editingItem.sortOrder
            || editor.itemForm.enabled !== editor.editingItem.enabled
        : !!editor.itemForm.code
            || !!editor.itemForm.name
            || editor.itemForm.sortOrder !== 0
            || !editor.itemForm.enabled,
    )
    const itemParsed = computed(() =>
        dictionaryItemFieldsSchema
            .extend({code: dictionaryCodeSchema})
            .safeParse(editor.itemForm),
    )
    const itemErrors = computed<Record<string, string>>(() =>
        itemParsed.value.success
            ? {}
            : Object.fromEntries(itemParsed.value.error.issues
                .filter(issue =>
                    editor.itemTouched[issue.path[0] as keyof typeof editor.itemTouched],
                )
                .map(issue => [String(issue.path[0]), issue.message])),
    )
    const dirty = computed(() =>
        metadataDirty.value
        || (editor.itemEditorOpen && itemDirty.value),
    )
    const canEditAny = () =>
        canUpdateType.value || canCreateItem.value || canUpdateItem.value

    function setFeedback(
        target: {feedback: AdminOperationResult | null},
        message: string,
        status: AdminOperationResult['status'] = 'success',
    ) {
        target.feedback = message.trim() ? {message, status} : null
    }

    function resetEditor() {
        loadSequence++
        Object.assign(editor, {
            dictionaryId: null,
            detail: null,
            loading: false,
            loadError: '',
            busy: false,
            typeError: '',
            feedback: null,
            typeForm: emptyTypeForm(),
            typeTouched: emptyTypeTouched(),
            itemSearch: '',
            itemStatus: '',
            itemPage: 1,
            itemPageSize: '20',
            itemEditorOpen: false,
            editingItem: null,
            itemError: '',
            itemForm: emptyItemForm(),
            itemTouched: emptyItemTouched(),
        })
    }

    function syncDetail(result: DictionaryDetail, syncType = true) {
        editor.detail = result
        if (syncType) {
            editor.typeForm = {
                code: result.code,
                name: result.name,
                description: result.description,
                enabled: result.enabled,
            }
            editor.typeTouched = emptyTypeTouched()
        }
        list.stale = true
    }

    async function loadList(query: AdminDictionaryQuery, force = false) {
        if (listPromise && !force && JSON.stringify(list.query) === JSON.stringify(query))
            return listPromise
        const requestSequence = ++listSequence
        const generation = session.generation
        list.query = {...query}
        list.pending = true
        list.error = ''
        listPromise = (async () => {
            try {
                const result = await requests.listDictionaries(query)
                if (requestSequence === listSequence && generation === session.generation) {
                    list.data = result
                    list.stale = false
                }
            } catch (error) {
                if (requestSequence === listSequence && generation === session.generation)
                    list.error = api.message(error)
            } finally {
                if (requestSequence === listSequence && generation === session.generation)
                    list.pending = false
                if (requestSequence === listSequence)
                    listPromise = null
            }
        })()
        return listPromise
    }

    async function enterList(query: AdminDictionaryQuery) {
        if (list.pending && JSON.stringify(list.query) === JSON.stringify(query))
            return listPromise ?? undefined
        if (!list.data || list.stale || JSON.stringify(list.query) !== JSON.stringify(query))
            await loadList(query, list.pending)
    }

    function leaveList() {
        listSequence++
        listPromise = null
        list.pending = false
        list.stale = true
        list.feedback = null
    }

    async function refreshList() {
        await loadList({...list.query}, true)
        if (list.error)
            throw new Error(list.error)
    }

    async function loadDetail() {
        if (!editor.open || !editor.dictionaryId)
            return
        const token = ++loadSequence
        const generation = session.generation
        const id = editor.dictionaryId
        editor.loading = true
        editor.loadError = ''
        try {
            const result = await requests.getDictionary(id)
            if (token === loadSequence && editor.open && editor.dictionaryId === id && generation === session.generation) {
                syncDetail(result)
                editor.itemEditorOpen = false
                editor.editingItem = null
                editor.itemForm = emptyItemForm()
                editor.itemTouched = emptyItemTouched()
                editor.itemError = ''
            }
        } catch (error) {
            if (token === loadSequence && generation === session.generation)
                editor.loadError = api.operationMessage(error)
        } finally {
            if (token === loadSequence && generation === session.generation)
                editor.loading = false
        }
    }

    async function openDictionary(id: string | null) {
        resetEditor()
        editor.open = true
        editor.dictionaryId = id
        if (id)
            await loadDetail()
    }

    async function refreshEditor() {
        if (!editor.open)
            return
        if (editor.dictionaryId)
            await loadDetail()
        else {
            resetEditor()
            editor.open = true
        }
        if (editor.loadError)
            throw new Error(editor.loadError)
    }

    async function saveType() {
        if (editor.busy)
            return {submitted: false, succeeded: false}
        Object.assign(editor.typeTouched, {
            code: true,
            name: true,
            description: true,
        })
        editor.typeError = ''
        if (!typeParsed.value.success || !typeEditable.value)
            return {submitted: false, succeeded: false}
        const revision = ++writeRevision
        const generation = session.generation
        const id = editor.detail?.id ?? null
        const isCreate = createMode.value
        editor.busy = true
        try {
            const result = isCreate
                ? await requests.createDictionary(dictionaryCreateSchema.parse(typeParsed.value.data))
                : await requests.updateDictionary(editor.detail!.id, {
                    ...typeParsed.value.data,
                    version: editor.detail!.version,
                })
            if (generation !== session.generation || id !== (editor.detail?.id ?? null))
                return {submitted: true, succeeded: false}
            syncDetail(result)
            list.stale = true
            setFeedback(
                editor,
                isCreate
                    ? '字典类型已创建，请继续添加部门或岗位选项。'
                    : result.enabled ? '字典基本信息已保存。' : '字典已停用；已有数据不会被删除。',
            )
            return {submitted: true, succeeded: true, id: result.id}
        } catch (error) {
            if (generation === session.generation)
                editor.typeError = api.operationMessage(error)
            return {submitted: true, succeeded: false}
        } finally {
            if (revision === writeRevision)
                editor.busy = false
        }
    }

    function startItem(row: DictionaryItem | null) {
        if (editor.busy)
            return
        editor.editingItem = row
        editor.itemForm = row ? {
            code: row.code,
            name: row.name,
            sortOrder: row.sortOrder,
            enabled: row.enabled,
        } : emptyItemForm()
        editor.itemTouched = emptyItemTouched()
        editor.itemError = ''
        editor.itemEditorOpen = true
    }

    function closeItemEditor() {
        if (editor.busy)
            return false
        editor.itemEditorOpen = false
        editor.editingItem = null
        editor.itemError = ''
        return true
    }

    async function saveItem() {
        if (!editor.detail || editor.busy || !writableItem.value)
            return {submitted: false, succeeded: false}
        Object.assign(editor.itemTouched, {
            code: true,
            name: true,
            sortOrder: true,
        })
        editor.itemError = ''
        if (!itemParsed.value.success)
            return {submitted: false, succeeded: false}
        const revision = ++writeRevision
        const generation = session.generation
        const dictionaryId = editor.detail.id
        const editingId = editor.editingItem?.id ?? null
        editor.busy = true
        try {
            const fields = {
                name: itemParsed.value.data.name,
                sortOrder: itemParsed.value.data.sortOrder,
                enabled: itemParsed.value.data.enabled,
                version: editor.detail.version,
            }
            const result = editor.editingItem
                ? await requests.updateItem(editor.editingItem.id, {
                    ...fields,
                    dictionaryId,
                })
                : await requests.createItem(dictionaryId, {
                    ...fields,
                    code: itemParsed.value.data.code,
                })
            if (
                generation !== session.generation
                || dictionaryId !== editor.detail?.id
                || editingId !== (editor.editingItem?.id ?? null)
            )
                return {submitted: true, succeeded: false}
            syncDetail(result, false)
            editor.itemEditorOpen = false
            editor.editingItem = null
            setFeedback(editor, editingId ? '字典选项已保存。' : '字典选项已创建。')
            return {submitted: true, succeeded: true, id: result.id}
        } catch (error) {
            if (generation === session.generation)
                editor.itemError = api.operationMessage(error)
            return {submitted: true, succeeded: false}
        } finally {
            if (revision === writeRevision)
                editor.busy = false
        }
    }

    function closeEditor() {
        resetEditor()
        editor.open = false
    }

    function resetForIdentityChange() {
        listSequence++
        writeRevision++
        listPromise = null
        Object.assign(list, {
            data: null,
            pending: false,
            error: '',
            stale: true,
            query: {},
            feedback: null,
        })
        resetEditor()
        editor.open = false
    }

    watch(() => session.generation, resetForIdentityChange)
    watch([() => editor.itemSearch, () => editor.itemStatus, () => editor.itemPageSize], () => {
        editor.itemPage = 1
    })
    watch(itemPages, value => {
        if (editor.itemPage > value)
            editor.itemPage = value
    })
    watch(() => [editor.typeForm.code, editor.typeForm.name, editor.typeForm.description, editor.typeForm.enabled], () => {
        editor.typeError = ''
    }, {flush: 'sync'})
    watch(() => [editor.itemForm.code, editor.itemForm.name, editor.itemForm.sortOrder, editor.itemForm.enabled], () => {
        editor.itemError = ''
    }, {flush: 'sync'})

    return {
        list,
        editor,
        canCreateType,
        canUpdateType,
        canCreateItem,
        canUpdateItem,
        createMode,
        typeEditable,
        dialogTitle,
        typeParsed,
        fieldErrors,
        metadataDirty,
        filteredItems,
        itemPages,
        pagedItems,
        writableItem,
        itemDirty,
        itemParsed,
        itemErrors,
        dirty,
        canEditAny,
        loadList,
        enterList,
        leaveList,
        refreshList,
        loadDetail,
        openDictionary,
        refreshEditor,
        saveType,
        startItem,
        closeItemEditor,
        saveItem,
        closeEditor,
    }
})
