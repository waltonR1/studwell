// 任务业务状态和唯一轮询；组件处理确认、可见性与进入/离开接线。
import {computed, reactive, ref, watch, onScopeDispose} from 'vue'
import {defineStore} from 'pinia'
import type {TaskRecord, TaskRunRecord, TaskSchedule, TaskRetention} from '#shared/types/admin/tasks'
import type {PageData} from '#shared/types/api'
import {taskUpdateSchema, taskPreviewSchema, taskRunQuerySchema} from '#shared/schemas/admin/tasks'
import {createTasksApi} from '~/api/admin/tasks'
import {useAdminRequestStore} from '~/stores/admin/request'
import type {AdminOperationResult} from '~/types/admin/action-result'
import type {AdminTaskDraft} from '~/types/admin/tasks'
import {ADMIN_TASK_POLL_INTERVAL_MS} from '~/config/admin/tasks'
import {useAdminSessionStore} from './session'
import {getAdminRequestFailure} from '~/utils/admin/request/errors'

// 仅用于草稿初始化、关闭重置及切换执行模式时的候选值，不是服务端任务缺失时的运行兜底。
// edit(row) 使用接口返回的执行模式、对应计划字段和保留天数覆盖；未启用模式的字段仍保留初始值，保存时按所选模式构造请求。
const emptyDraft = (): AdminTaskDraft => ({mode: 'daily', time: '03:00', minutes: 15, expression: '0 3 * * *', login: 180, audit: 730, security: 730})


export const useAdminTasksStore = defineStore('admin-tasks', () => {
    const api = useAdminRequestStore(), tasks = createTasksApi(api), session = useAdminSessionStore()
    const data = ref<TaskRecord[] | null>(null), pending = ref(false), error = ref('')
    const search = ref(''), enabled = ref(''), latestStatus = ref(''), stale = ref(false)
    const busy = ref(false), validationError = ref(''), loadFailure = ref('')
    const notification = ref<AdminOperationResult | null>(null)
    const active = ref(false), pollingPaused = ref(false)
    const editing = ref<TaskRecord | null>(null), draft = reactive(emptyDraft())
    const original = ref(''), previewTimes = ref<string[]>([])
    const historyTask = ref<TaskRecord | null>(null), history = ref<PageData<TaskRunRecord> | null>(null)
    const detail = ref<TaskRunRecord | null>(null), historyBusy = ref(false)
    const filters = reactive({status: '', trigger: '', startDate: '', endDate: ''}), page = ref(1)
    const applied = ref<Record<string, string | number>>({})
    let lifecycle = 0, listRevision = 0, historyRevision = 0, detailRevision = 0, writeRevision = 0
    let timer: ReturnType<typeof setInterval> | undefined
    let polling = false
    let loadPromise: Promise<void> | null = null
    const current = (life: number, generation: number) => life === lifecycle && generation === session.generation
    const rows = computed(() => (data.value ?? []).filter(t =>
        (!search.value || (t.name + t.code).includes(search.value.trim()))
        && (!enabled.value || String(t.enabled) === enabled.value)
        && (!latestStatus.value || t.lastRun?.status === latestStatus.value)))
    const dirty = computed(() => !!editing.value && JSON.stringify(draft) !== original.value)
    const currentTask = computed(() => data.value?.find(row => row.id === editing.value?.id) ?? editing.value)
    const configurationStale = computed(() => !!editing.value && currentTask.value?.version !== editing.value.version)
    const runDisabledReason = computed(() => dirty.value ? '请先保存配置，再立即执行。' : configurationStale.value ? '配置已发生变化，请关闭后重新打开。' : !currentTask.value?.executionAllowed ? '当前环境禁止执行任务。' : !currentTask.value.online ? '调度器离线，暂时无法执行。' : currentTask.value.activeRun ? '任务已排队或正在执行。' : '')
    const canConfigure = computed(() => session.can('system.tasks.update'))
    const canRun = computed(() => session.can('system.tasks.run'))
    const canStop = computed(() => session.can('system.tasks.stop'))
    const canForceStop = computed(() => session.can('system.tasks.force_stop'))
    const canChangeStatus = computed(() => session.can('system.tasks.change_status'))
    const canReadAudit = computed(() => session.can('system.logs.audit.read'))

    function schedule(): TaskSchedule {
        return draft.mode === 'daily' ? {mode: 'daily', time: draft.time}
            : draft.mode === 'interval' ? {mode: 'interval', minutes: Number(draft.minutes)}
                : {mode: 'cron', expression: draft.expression}
    }
    function edit(row: TaskRecord) {
        if (busy.value) return
        editing.value = row
        Object.assign(draft, emptyDraft(), {
            mode: row.schedule.mode,
            ...(row.schedule.mode === 'daily' ? {time: row.schedule.time}
                : row.schedule.mode === 'interval' ? {minutes: row.schedule.minutes}
                    : {expression: row.schedule.expression}),
            ...row.retention,
        })
        original.value = JSON.stringify(draft)
        previewTimes.value = []
        validationError.value = ''
    }
    function closeEditor() {
        editing.value = null
        Object.assign(draft, emptyDraft())
        original.value = ''
        previewTimes.value = []
    }
    async function reload(force = false) {
        if (loadPromise && !force) return loadPromise
        const revision = ++listRevision, life = lifecycle, generation = session.generation
        pending.value = true
        error.value = ''
        loadPromise = (async () => {
            try {
                const result = await tasks.listTasks()
                if (revision === listRevision && current(life, generation)) {
                    data.value = result
                    stale.value = false
                }
            } catch (cause) {
                if (revision === listRevision && current(life, generation)) {
                    error.value = api.message(cause)
                    throw new Error(error.value)
                }
            } finally {
                if (revision === listRevision && current(life, generation)) {
                    pending.value = false
                    loadPromise = null
                }
            }
        })()
        return loadPromise
    }
    async function enter() {
        active.value = true
        await reload().catch(() => {})
    }
    function closeDetail() {
        detailRevision++
        detail.value = null
    }
    function closeHistory() {
        historyRevision++
        historyTask.value = null
        history.value = null
        historyBusy.value = false
        closeDetail()
    }
    async function loadHistory(quiet = false) {
        if (!historyTask.value) return
        loadFailure.value = ''
        const revision = ++historyRevision, id = historyTask.value.id
        const life = lifecycle, generation = session.generation
        if (!quiet) historyBusy.value = true
        try {
            // 执行历史显式固定每页 20 条，不是缺省兜底；因此不会采用服务端数据库参数中的默认每页条数。
            const parsed = taskRunQuerySchema.safeParse({...applied.value, page: String(page.value), pageSize: '20'})
            if (!parsed.success) throw new Error('请检查任务记录的状态、日期与分页条件。')
            const result = await tasks.listTaskRuns(id, {
                ...parsed.data, page: String(parsed.data.page), pageSize: String(parsed.data.pageSize),
            })
            if (revision === historyRevision && current(life, generation) && historyTask.value?.id === id)
                history.value = result
        } catch (cause) {
            if (revision === historyRevision && current(life, generation)) {
                loadFailure.value = api.operationMessage(cause)
                throw cause
            }
        } finally {
            if (revision === historyRevision && current(life, generation)) historyBusy.value = false
        }
    }
    async function showHistory(row: TaskRecord) {
        closeHistory()
        historyTask.value = row
        page.value = 1
        applied.value = {}
        Object.assign(filters, {status: '', trigger: '', startDate: '', endDate: ''})
        await loadHistory().catch(() => {})
    }
    async function filterHistory(reset = true) {
        if (reset) {
            page.value = 1
            applied.value = Object.fromEntries(Object.entries(filters).filter(([, value]) => value))
        }
        await loadHistory().catch(() => {})
    }
    async function showDetail(row: TaskRunRecord) {
        loadFailure.value = ''
        const revision = ++detailRevision, life = lifecycle, generation = session.generation
        try {
            const result = await tasks.getTaskRun(row.id)
            if (revision === detailRevision && current(life, generation)) detail.value = result
        } catch (cause) {
            if (revision === detailRevision && current(life, generation)) loadFailure.value = api.operationMessage(cause)
        }
    }
    async function refreshDetail() {
        if (detail.value) await showDetail(detail.value)
    }
    async function preview() {
        const row = editing.value
        if (!row || busy.value) return
        const parsed = taskPreviewSchema.safeParse({code: row.code, schedule: schedule()})
        if (!parsed.success) { validationError.value = '请检查执行计划。'; return }
        const baseline = JSON.stringify(draft), life = lifecycle, generation = session.generation
        const revision = ++writeRevision
        busy.value = true
        validationError.value = ''
        notification.value = null
        try {
            const result = await tasks.previewSchedule(parsed.data)
            if (current(life, generation) && editing.value === row && JSON.stringify(draft) === baseline)
                {
                    previewTimes.value = result.times
                    notification.value = {message: '执行时间预览已更新。', status: 'success'}
                }
        } catch (cause) {
            if (current(life, generation)) notifyFailure(cause,true)
        } finally {
            if (revision === writeRevision) busy.value = false
        }
    }
    async function refresh() {
        const life = lifecycle, generation = session.generation
        closeEditor()
        await reload(true)
        if (current(life, generation) && historyTask.value) await loadHistory()
    }
    function notifyFailure(cause: unknown,fieldValidation=false) {
        const generic = api.operationMessage(cause),failure=getAdminRequestFailure(cause)
        const message=generic?(failure?.fields?.join('；')||generic):''
        if(fieldValidation&&failure?.code==='INVALID_INPUT'){
            validationError.value=message
            return
        }
        notification.value = message ? {message, status: 'error'} : null
    }
    async function mutate(work: () => Promise<unknown>, success: string, saved?: () => void,fieldValidation=false) {
        if (busy.value) return false
        const revision = ++writeRevision, life = lifecycle, generation = session.generation
        busy.value = true
        validationError.value = ''
        notification.value = null
        try {
            await work()
            if (!current(life, generation)) return false
            saved?.()
            try {
                await reload(true)
                if (!current(life, generation)) return false
                if (historyTask.value) await loadHistory()
                if (!current(life, generation)) return false
                notification.value = {message: success, status: 'success'}
                return true
            } catch {
                if (current(life, generation)) {
                    stale.value = true
                    notification.value = {message: success + ' 状态刷新失败，请刷新查看，勿重复提交。', status: 'warning'}
                }
                return false
            }
        } catch (cause) {
            if (current(life, generation)) notifyFailure(cause,fieldValidation)
            return false
        } finally {
            if (revision === writeRevision) busy.value = false
        }
    }
    async function save() {
        const row = editing.value, life = lifecycle, generation = session.generation
        if (!row || !canConfigure.value || !dirty.value) return
        const retention: TaskRetention | null = row.retention ? {
            login: Number(draft.login), audit: Number(draft.audit), security: Number(draft.security),
        } : null
        const request = {version: row.version, schedule: schedule(), retention}
        const parsed = taskUpdateSchema.safeParse(request)
        if (!parsed.success) { validationError.value = '请检查执行计划和保留天数。'; return }
        const refreshed = await mutate(() => tasks.updateTask(row.id, parsed.data),
            '任务配置已保存；当前执行继续使用原配置快照。', closeEditor,true)
        if (refreshed && current(life, generation)) {
            const latest = data.value?.find(item => item.id === row.id)
            if (latest) edit(latest)
        }
    }
    async function toggle(row: TaskRecord) {
        if (!canChangeStatus.value) return
        await mutate(() => tasks.changeTaskStatus(row.id, {version: row.version, enabled: !row.enabled}), '任务状态已保存。')
    }
    async function run(row: TaskRecord) {
        if (dirty.value || configurationStale.value || !canRun.value || !row.executionAllowed || !row.online || row.activeRun) return
        await mutate(() => tasks.runTask(row.id, row.version), '执行请求已受理，请在执行记录中查看结果。')
    }
    async function control(record: TaskRunRecord, action: 'stop' | 'force') {
        if (action === 'force' ? !canForceStop.value : !canStop.value) return
        await mutate(() => tasks.controlTaskRun(record.id, action), '控制请求已受理，最终状态以执行记录为准。')
    }
    async function poll() {
        if (!active.value || polling || pollingPaused.value || busy.value || dirty.value || historyBusy.value) return
        const life = lifecycle, generation = session.generation
        polling = true
        try {
            await reload()
            if (!current(life, generation) || !active.value || pollingPaused.value || dirty.value || busy.value) return
            if (historyTask.value) await loadHistory(true)
            if (current(life, generation) && active.value && !pollingPaused.value && !dirty.value && !busy.value) await refreshDetail()
        } catch {
            if (current(life, generation)) stale.value = true
        } finally {
            if (current(life, generation)) polling = false
        }
    }
    function startPolling() {
        if (!active.value || timer !== undefined || typeof window === 'undefined') return
        timer = setInterval(() => { void poll() }, ADMIN_TASK_POLL_INTERVAL_MS)
    }
    function stopPolling() {
        clearInterval(timer)
        timer = undefined
    }
    function leave() {
        stopPolling()
        lifecycle++
        listRevision++
        writeRevision++
        loadPromise = null
        polling = false
        active.value = false
        pollingPaused.value = false
        busy.value = false
        pending.value = false
        closeEditor()
        closeHistory()
        Object.assign(filters, {status: '', trigger: '', startDate: '', endDate: ''})
        applied.value = {}
        page.value = 1
        notification.value = null
        validationError.value = ''
        loadFailure.value = ''
    }
    watch(draft, () => { previewTimes.value = [] }, {flush: 'sync'})
    watch(() => session.generation, () => {
        leave()
        data.value = null
        search.value = ''
        enabled.value = ''
        latestStatus.value = ''
        error.value = ''
        stale.value = false
    }, {flush: 'sync'})
    onScopeDispose(leave)
    return {data, pending, error, search, enabled, latestStatus, stale, rows, busy, notification, validationError, loadFailure,
        active, pollingPaused, editing, draft, dirty, previewTimes, currentTask, configurationStale, runDisabledReason,
        original, applied, historyTask, history, detail, filters, page, historyBusy, canConfigure, canRun, canStop, canForceStop,
        canChangeStatus, canReadAudit, enter, reload, refresh, edit, closeEditor, preview, save, toggle, run, control,
        loadHistory, showHistory, filterHistory, showDetail, refreshDetail, closeDetail, closeHistory, poll, startPolling, stopPolling, leave}
})
