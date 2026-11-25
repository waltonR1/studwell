import type {AdminOperationResult} from '~/types/admin/action-result'
// 后台参数列表、本地筛选分页、参数组关联草稿及批量保存生命周期。
import {computed, reactive, ref, watch} from 'vue'
import {defineStore} from 'pinia'

import {parameterGroups} from '~/config/admin/parameters'
import type {ParameterGroup, ParameterRecord, ParameterValue} from '#shared/types/admin/parameters'
import {parameterRelations} from '#shared/utils/admin/parameter-relations'
import {parameterBatchSchema} from '#shared/schemas/admin/parameters'
import {createParametersApi} from '~/api/admin/parameters'
import {useAdminRequestStore} from '~/stores/admin/request'
import {useAdminSessionStore} from './session'


export const useAdminParametersStore = defineStore('admin-parameters', () => {
    const session = useAdminSessionStore()
    const api = useAdminRequestStore()
    const requests = createParametersApi(api)

    const originals = reactive<Record<string, ParameterRecord>>({})
    const draft = reactive<Record<string, ParameterValue | string>>({})
    const pending = ref(false)
    const loadError = ref('')
    const busy = ref(false)
    const submitError = ref('')
    const warning = ref('')
    const feedback = ref<AdminOperationResult | null>(null)
    const open = ref(false)
    const selectedIds = ref<string[]>([])
    const search = ref('')
    const appliedSearch = ref('')
    const category = ref('')
    const page = ref(1)
    const pageSize = ref('20')

    let loadSequence = 0
    let writeRevision = 0
    let loadPromise: Promise<void> | null = null

    const rows = computed(() => Object.values(originals))
    const filteredRows = computed(() =>
        rows.value.filter(row =>
            (!category.value || row.group === category.value)
            && (
                !appliedSearch.value
                || `${row.name} ${row.key}`.toLowerCase().includes(appliedSearch.value.toLowerCase())
            ),
        ),
    )
    const pageRows = computed(() =>
        filteredRows.value.slice(
            (page.value - 1) * Number(pageSize.value),
            page.value * Number(pageSize.value),
        ),
    )
    const editorRows = computed(() =>
        selectedIds.value
            .map(id => originals[id])
            .filter((row): row is ParameterRecord => !!row),
    )
    const editorGroup = computed<ParameterGroup>(() =>
        editorRows.value[0]?.group ?? 'general',
    )
    const editorTitle = computed(() => editorRows.value[0]?.name ?? '参数')
    const canEdit = (row: ParameterRecord) =>
        row.editable
        && session.can('system.parameters.update')
        && (!row.security || session.can('system.parameters.security.update'))
    const editorEditable = computed(() => editorRows.value.some(canEdit))
    const dirty = computed(() =>
        parameterGroups.some(group => dirtyGroup(group.key)),
    )

    function groupName(group: ParameterGroup) {
        return parameterGroups.find(item => item.key === group)?.name ?? ''
    }

    function displayValue(value: ParameterValue, row: ParameterRecord) {
        return row.type === 'boolean'
            ? value ? '开启' : '关闭'
            : String(value) + (row.unit ? ' ' + row.unit : '')
    }

    function valueOf(row: ParameterRecord) {
        return row.type === 'boolean'
            ? draft[row.id] as boolean
            : Number(draft[row.id])
    }

    function changed(row: ParameterRecord) {
        return valueOf(row) !== row.value
    }

    function dirtyGroup(group: ParameterGroup) {
        return rows.value.some(row => row.group === group && changed(row))
    }

    function invalid(row: ParameterRecord) {
        const value = valueOf(row)
        return row.type === 'boolean'
            ? typeof value !== 'boolean'
            : !Number.isSafeInteger(value)
                || Number(value) < row.min!
                || Number(value) > row.max!
                || (row.allowedValues.length > 0 && !row.allowedValues.includes(Number(value)))
    }

    function applySearch() {
        appliedSearch.value = search.value.trim()
        page.value = 1
    }

    function replaceRows(next: ParameterRecord[], discardDraft = false) {
        if (discardDraft) {
            for (const key of Object.keys(originals))
                delete originals[key]
            for (const key of Object.keys(draft))
                delete draft[key]
            for (const row of next) {
                originals[row.id] = row
                draft[row.id] = row.value
            }
            return
        }
        const keep = new Set(
            parameterGroups
                .filter(group => dirtyGroup(group.key))
                .map(group => group.key),
        )
        for (const row of next) {
            if (!keep.has(row.group)) {
                originals[row.id] = row
                draft[row.id] = row.value
            }
        }
    }

    async function load(
        force = false,
        defaultPageSize = 20,
        discardDraft = false,
    ) {
        if (loadPromise && !force)
            return loadPromise
        const requestSequence = ++loadSequence
        const generation = session.generation
        if (!rows.value.length)
            pageSize.value = String(defaultPageSize)
        pending.value = true
        loadError.value = ''
        loadPromise = (async () => {
            try {
                const next = await requests.listParameters()
                if (requestSequence === loadSequence && generation === session.generation)
                    replaceRows(next, discardDraft)
            } catch (error) {
                if (requestSequence === loadSequence && generation === session.generation)
                    loadError.value = api.message(error)
            } finally {
                if (requestSequence === loadSequence && generation === session.generation)
                    pending.value = false
                if (requestSequence === loadSequence)
                    loadPromise = null
            }
        })()
        return loadPromise
    }

    async function refresh(defaultPageSize = 20, discardDraft = false) {
        await load(true, defaultPageSize, discardDraft)
        if (loadError.value)
            throw new Error(loadError.value)
    }

    function edit(row: ParameterRecord) {
        if (busy.value)
            return
        selectedIds.value = [row.id]
        draft[row.id] = row.value
        submitError.value = ''
        open.value = true
    }

    function close() {
        if (busy.value)
            return false
        for (const row of editorRows.value)
            draft[row.id] = row.value
        open.value = false
        selectedIds.value = []
        return true
    }

    async function reload(defaultPageSize = 20) {
        open.value = false
        selectedIds.value = []
        for (const key of Object.keys(originals))
            delete originals[key]
        warning.value = ''
        await refresh(defaultPageSize, true)
    }

    async function discardAndReload(defaultPageSize = 20) {
        open.value = false
        selectedIds.value = []
        submitError.value = ''
        warning.value = ''
        await refresh(defaultPageSize, true)
    }

    function leave() {
        loadSequence++
        writeRevision++
        loadPromise = null
        open.value = false
        selectedIds.value = []
        submitError.value = ''
        warning.value = ''
        feedback.value = null
        for (const key of Object.keys(originals))
            delete originals[key]
        for (const key of Object.keys(draft))
            delete draft[key]
    }

    async function save(
        group: ParameterGroup,
        reset = false,
    ) {
        if (busy.value)
            return {submitted: false, succeeded: false}
        const targets = editorRows.value.filter(row =>
            row.group === group
            && (
                reset
                    ? row.override !== null || row.invalidOverride || changed(row)
                    : changed(row) || row.invalidOverride
            ),
        )
        if (!targets.length || targets.some(row => !canEdit(row)))
            return {submitted: false, succeeded: false}
        if (!reset && (group === 'session' || group === 'password')) {
            const values = Object.fromEntries(
                rows.value
                    .filter(row => row.group === group)
                    .map(row => [row.key, valueOf(row)]),
            )
            const relation = parameterRelations(values, group)
            if (relation) {
                submitError.value = relation
                return {submitted: false, succeeded: false}
            }
        }
        if (!reset && targets.some(invalid))
            return {submitted: false, succeeded: false}
        const generation = session.generation
        const revision = ++writeRevision
        const request = {
            items: targets.map(row => ({
                id: row.id,
                version: row.version,
                value: reset ? null : valueOf(row),
            })),
        }
        const parsed = parameterBatchSchema.safeParse(request)
        if (!parsed.success) {
            submitError.value = '请检查参数更新内容。'
            return {submitted: false, succeeded: false}
        }
        submitError.value = ''
        warning.value = ''
        feedback.value = null
        busy.value = true
        try {
            const saved = await requests.updateParameterBatch(parsed.data)
            if (generation !== session.generation)
                return {submitted: true, succeeded: false}
            for (const row of saved) {
                originals[row.id] = row
                draft[row.id] = row.value
            }
            open.value = false
            selectedIds.value = []
            try {
                if (group === 'password')
                    await api.refreshSession()
                await load(true, Number(pageSize.value))
                if (generation !== session.generation)
                    return {submitted: true, succeeded: false}
                if (loadError.value)
                    throw new Error(loadError.value)
                feedback.value = {
                    message: reset ? '参数已恢复默认值。' : '参数已保存。',
                    status: 'success',
                }
            } catch {
                if (generation !== session.generation)
                    return {submitted: true, succeeded: false}
                warning.value = '参数已保存，但状态刷新失败，请使用顶部刷新重试。'
            }
            return {submitted: true, succeeded: true}
        } catch (error) {
            if (generation === session.generation)
                submitError.value = api.operationMessage(error)
            return {submitted: true, succeeded: false}
        } finally {
            if (revision === writeRevision)
                busy.value = false
        }
    }

    function resetForIdentityChange() {
        loadSequence++
        writeRevision++
        loadPromise = null
        for (const key of Object.keys(originals))
            delete originals[key]
        for (const key of Object.keys(draft))
            delete draft[key]
        pending.value = false
        loadError.value = ''
        busy.value = false
        submitError.value = ''
        warning.value = ''
        feedback.value = null
        open.value = false
        selectedIds.value = []
        search.value = ''
        appliedSearch.value = ''
        category.value = ''
        page.value = 1
    }

    watch(() => session.generation, resetForIdentityChange)
    watch(draft, () => {
        submitError.value = ''
    }, {flush: 'sync'})

    return {
        originals,
        draft,
        pending,
        loadError,
        busy,
        submitError,
        warning,
        feedback,
        open,
        selectedIds,
        search,
        appliedSearch,
        category,
        page,
        pageSize,
        rows,
        filteredRows,
        pageRows,
        editorRows,
        editorGroup,
        editorTitle,
        editorEditable,
        dirty,
        groupName,
        displayValue,
        applySearch,
        load,
        refresh,
        reload,
        discardAndReload,
        leave,
        edit,
        close,
        valueOf,
        changed,
        dirtyGroup,
        canEdit,
        invalid,
        save,
    }
})
