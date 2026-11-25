import type {AdminOperationResult} from '~/types/admin/action-result'
// 当前日志类别的查询、列表、详情与导出状态；URL、焦点和剪贴板由组件处理。
import {computed, reactive, ref, watch, onScopeDispose} from 'vue'
import {defineStore} from 'pinia'
import type {AdminLogQuery} from '~/types/admin/logs'
import type {LogRecord} from '#shared/types/admin/logs'
import {logActionCatalog} from '#shared/utils/admin/logs'
import {logResultNames, logResults} from '#shared/config/admin/logs'
import {type LogKind} from '#shared/types/admin/logs'
import {logFilterSchema, logExportSchema} from '#shared/schemas/admin/logs'
import {beijingDate} from '#shared/utils/beijing-time'
import {readAdminPage, readAdminPageSize} from '~/utils/admin/list/query'
import {hasSource} from '~/utils/admin/logs/presentation'
import {createLogsApi} from '~/api/admin/logs'
import {useAdminRequestStore} from '~/stores/admin/request'
import {useAdminSessionStore} from './session'

const emptyFilters = () => ({period: '7d', startDate: '', endDate: '', account: '', actorId: '', action: '', result: '', ip: '', requestId: '', logId: ''})

export const useAdminLogsStore = defineStore('admin-logs', () => {
    const api = useAdminRequestStore(), requests = createLogsApi(api), session = useAdminSessionStore()
    const kind = ref<LogKind>('login'), filters = reactive(emptyFilters())
    const query = ref<AdminLogQuery>({}), pageSize = ref('20')
    const data = ref<Awaited<ReturnType<typeof requests.listLogs>> | null>(null)
    const pending = ref(false), loadError = ref(''), busy = ref(false), searchError = ref('')
    const includeSources = ref(false)
    const feedback = ref<AdminOperationResult | null>(null)
    const open = ref(false), selected = ref<LogRecord | null>(null), detailBusy = ref(false), detailError = ref('')
    let listRevision = 0, detailRevision = 0, exportRevision = 0
    const routePageSize = computed(() => readAdminPageSize(query.value.pageSize))
    const page = computed(() => readAdminPage(query.value.page, routePageSize.value))
    const sources = computed(() => session.can(`system.logs.${kind.value}.sources.read`))
    const sourceExport = computed(() => sources.value && session.can(`system.logs.${kind.value}.sources.export`))
    function applied() {
        return Object.fromEntries(Object.entries(query.value).filter(([key, value]) => key !== 'page' && key !== 'pageSize' && value !== undefined)) as Record<string, string>
    }
    const actionItems = computed(() => [{label: '全部事件', value: ''},
        ...Object.entries(logActionCatalog(kind.value)).map(([value, label]) => ({value, label})),
        ...(kind.value === 'audit' ? [{label: '其他事件', value: 'other'}] : [])])
    const resultItems = computed(() => [{label: '全部结果', value: ''},
        ...logResults[kind.value].map(value => ({value, label: logResultNames[value]!}))])
    function resultFilterName(value: string) {
        const parsed = logFilterSchema.shape.result.safeParse(value)
        return parsed.success && parsed.data ? logResultNames[parsed.data] : value
    }
    const effectiveFilters = computed(() => {
        const labels: Record<string, string> = {requestId: '请求编号', logId: '记录编号', account: '用户名', actorId: '账号 ID', action: '事件', result: '结果', ip: '来源 IP'}
        return Object.entries(applied()).filter(([key]) => key in labels && (key !== 'ip' || sources.value)).map(([key, value]) => ({key,
            text: labels[key] + '：' + (key === 'action' ? logActionCatalog(kind.value)[value] ?? '其他事件' : key === 'result' ? resultFilterName(value) : value)}))
    })
    const exportFilterRows = computed(() => {
        const context = selected.value?.exportContext
        if (!context) return []
        const result: Array<{label: string, value: string}> = []
        if (context.filters.requestId) result.push({label: '请求编号', value: context.filters.requestId})
        if (context.filters.logId) result.push({label: '记录编号', value: context.filters.logId})
        if (context.filters.account) result.push({label: '用户名', value: context.filters.account})
        if (context.filters.actorId) result.push({label: '账号 ID', value: context.filters.actorId})
        if (context.filters.action) result.push({label: '事件', value: logActionCatalog(context.kind)[context.filters.action] ?? '其他事件'})
        if (context.filters.result) result.push({label: '结果', value: logResultNames[context.filters.result]})
        if (hasSource(context.filters.ip)) result.push({label: '来源 IP', value: context.filters.ip!})
        return result
    })
    function closeDetail() {
        detailRevision++
        open.value = false
        selected.value = null
        detailBusy.value = false
        detailError.value = ''
    }
    async function load() {
        const revision = ++listRevision, generation = session.generation, requestKind = kind.value
        pending.value = true
        loadError.value = ''
        try {
            const result = await requests.listLogs(requestKind, {...applied(), page: page.value, pageSize: routePageSize.value})
            if (revision === listRevision && generation === session.generation && kind.value === requestKind) {
                data.value = result
                pageSize.value = String(result.pageSize)
            }
        } catch (cause) {
            if (revision === listRevision && generation === session.generation) loadError.value = api.message(cause)
        } finally {
            if (revision === listRevision && generation === session.generation) pending.value = false
        }
    }
    async function enter(nextKind: LogKind, nextQuery: AdminLogQuery, defaultPageSize = 20) {
        if (kind.value !== nextKind) {
            leave()
            data.value = null
            includeSources.value = false
            feedback.value = null
        }
        kind.value = nextKind
        query.value = {...nextQuery}
        for (const key of Object.keys(filters) as Array<keyof typeof filters>)
            filters[key] = String(nextQuery[key] ?? (key === 'period' ? '7d' : ''))
        pageSize.value = String(routePageSize.value ?? defaultPageSize)
        await load()
    }
    async function refresh() {
        await load()
        if (loadError.value) throw new Error(loadError.value)
    }
    function buildQuery(next = 1, applyText = false) {
        const values = Object.fromEntries(Object.entries(filters).filter(([, value]) => value)
            .filter(([key]) => filters.period === 'custom' || !['startDate', 'endDate'].includes(key)))
        if (!applyText) for (const key of ['account', 'actorId', 'ip', 'requestId', 'logId']) {
            delete values[key]
            if (applied()[key]) values[key] = applied()[key]!
        }
        if (!logExportSchema.safeParse(values).success || (filters.result && !logResults[kind.value].some(result => result === filters.result))) {
            searchError.value = '请检查日期、用户名、账号 ID、请求编号和记录编号。'
            return null
        }
        return {...values, page: String(next), pageSize: pageSize.value}
    }
    function changePeriod() {
        if (filters.period === 'custom') {
            filters.startDate ||= beijingDate(new Date())
            filters.endDate ||= filters.startDate
        }
    }
    async function openDetail(row: LogRecord) {
        const revision = ++detailRevision, generation = session.generation, requestKind = kind.value
        open.value = true
        selected.value = null
        detailBusy.value = true
        detailError.value = ''
        try {
            const result = await requests.getLog(requestKind, row.id)
            if (revision === detailRevision && generation === session.generation && kind.value === requestKind) selected.value = result
        } catch (cause) {
            if (revision === detailRevision && generation === session.generation) detailError.value = api.message(cause)
        } finally {
            if (revision === detailRevision && generation === session.generation) detailBusy.value = false
        }
    }
    async function exportCsv() {
        if (busy.value || !session.can(`system.logs.${kind.value}.export`)) return
        const parsed = logExportSchema.safeParse({...applied(), includeSources: includeSources.value})
        if (!parsed.success) { searchError.value = '当前筛选无效，请重新查询。'; return }
        const revision = ++exportRevision, generation = session.generation
        busy.value = true
        try {
            const file = await requests.exportLogs(kind.value, parsed.data)
            if (revision === exportRevision && generation === session.generation) {
                feedback.value = {message: `CSV 已生成，共 ${file.count} 条。`, status: 'success'}
                return file
            }
        } catch (cause) {
            if (revision === exportRevision && generation === session.generation) feedback.value = {message: api.operationMessage(cause), status: 'error'}
        } finally {
            if (revision === exportRevision) busy.value = false
        }
    }
    function leave() {
        listRevision++
        exportRevision++
        pending.value = false
        busy.value = false
        closeDetail()
        feedback.value = null
    }
    watch(filters, () => { searchError.value = '' }, {flush: 'sync'})
    watch(() => session.generation, () => {
        leave()
        data.value = null
        query.value = {}
        Object.assign(filters, emptyFilters())
        includeSources.value = false
        loadError.value = ''
        searchError.value = ''
    }, {flush: 'sync'})
    onScopeDispose(leave)
    return {kind, filters, query, pageSize, data, pending, loadError, busy, searchError, includeSources, feedback,
        open, selected, detailBusy, detailError, page, sources, sourceExport, actionItems, resultItems, effectiveFilters,
        exportFilterRows, applied, enter, load, refresh, buildQuery, changePeriod, openDetail, closeDetail, exportCsv, leave}
})
