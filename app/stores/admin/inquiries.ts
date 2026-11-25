import {computed, onScopeDispose, ref, shallowRef, watch} from 'vue'
import {defineStore} from 'pinia'
import type {InquiryListQuery, InquiryStatus, InquiryUpdate} from '#shared/schemas/admin/inquiries'
import type {InquiryAssignee, InquiryDetailResponse, InquiryInbox} from '#shared/types/admin/inquiry-responses'
import type {AdminOperationResult} from '~/types/admin/action-result'
import {createInquiriesApi} from '~/api/admin/inquiries'
import {INQUIRY_DELIVERY_POLL_INTERVAL_MS} from '~/config/admin/inquiries'
import {getAdminRequestFailure} from '~/utils/admin/request/errors'
import {useAdminRequestStore} from './request'
import {useAdminSessionStore} from './session'

const successMessages: Record<InquiryUpdate['action'], string> = {
    update: '咨询处理信息已保存。',
    note: '跟进已记录。',
    external_reply: '已登记外部回复。',
    mail_reply: '回复邮件已加入投递队列。',
    mail_retry: '邮件已加入重试队列。',
    mail_close: '投递异常已关闭。',
}
type FormSection = 'assignment' | 'note' | 'reply' | 'close'
const sections: Record<InquiryUpdate['action'], FormSection> = {
    update:'assignment', note:'note', external_reply:'note', mail_reply:'reply', mail_retry:'reply', mail_close:'close',
}

export const useAdminInquiriesStore = defineStore('admin-inquiries', () => {
    const request = useAdminRequestStore(), api = createInquiriesApi(request), session = useAdminSessionStore()
    const listError = ref(''), warning = ref('')
    const list = shallowRef<InquiryInbox | null>(null), loading = ref(true)
    const selected = ref(''), detail = shallowRef<InquiryDetailResponse | null>(null), assignees = ref<InquiryAssignee[]>([])
    const detailPending = ref(false), busy = ref(false), detailError = ref(''), detailVisible = ref(false)
    const detailStale = ref(false)
    const submitErrors = ref<Partial<Record<FormSection, string>>>({})
    const deliveryPollingPaused = ref(true)
    const nextStatus = ref(''), assignee = ref(''), note = ref(''), repliedExternally = ref(false), reply = ref('')
    const closingDelivery = ref(''), closeReason = ref('')
    const canRead = computed(() => session.can('content.inquiries.read'))
    const writable = computed(() => session.can('content.inquiries.update'))
    const canAssign = computed(() => session.can('content.inquiries.assign'))
    const canSend = computed(() => session.can('content.inquiries.mail.send'))
    const canReply = computed(() => canSend.value && !!detail.value && detail.value.inquiry.status !== 'spam' && detail.value.mailKinds.includes('reply'))
    const awaitingDelivery = computed(() => detail.value?.mail.some(item => item.status === 'queued' || item.status === 'sending') ?? false)
    const canClaim = computed(() => writable.value && !!detail.value && !detail.value.inquiry.assigneeId
        && ['pending', 'awaiting_reply', 'in_progress', 'waiting_customer'].includes(detail.value.inquiry.status))
    const changed = computed(() => !!detail.value && (nextStatus.value !== detail.value.inquiry.status || assignee.value !== (detail.value.inquiry.assigneeId ?? '')))
    const dirty = computed(() => changed.value || !!(note.value || repliedExternally.value || reply.value || closeReason.value))
    const identity = computed(() => session.generation)
    let listRevision = 0, detailRevision = 0, requestedPage = 1, polling = false
    let deliveryPollTimer: ReturnType<typeof setTimeout> | undefined
    let appliedQuery: InquiryListQuery | null = null

    async function fetchList(page: number, query: InquiryListQuery, refresh = false) {
        const revision = ++listRevision
        const generation = session.generation
        loading.value = true; listError.value = ''
        try {
            const result = await api.list({...query, page})
            if (revision !== listRevision || generation !== session.generation) return false
            const lastPage = Math.max(1, Math.ceil(result.total / result.pageSize))
            if (page > lastPage) {
                requestedPage = lastPage
                return await fetchList(lastPage, query, refresh)
            }
            list.value = result
            warning.value = ''
            return true
        } catch (error) {
            if (revision === listRevision && generation === session.generation && !refresh) listError.value = request.message(error)
            return false
        } finally {
            if (revision === listRevision) loading.value = false
        }
    }

    function enter(query: InquiryListQuery) {
        appliedQuery = query
        requestedPage = query.page
        return fetchList(query.page, query)
    }

    function refreshList() {
        return appliedQuery ? fetchList(requestedPage, appliedQuery) : Promise.resolve(false)
    }

    function show(result: InquiryDetailResponse) {
        detail.value = result
        nextStatus.value = result.inquiry.status
        assignee.value = result.inquiry.assigneeId ?? ''
    }

    function cancelMailClose() {
        closingDelivery.value = ''; closeReason.value = ''
        submitErrors.value.close = ''
    }

    function beginMailClose(id: string) {
        cancelMailClose()
        closingDelivery.value = id
    }

    function resetDraft() {
        nextStatus.value = ''; assignee.value = ''; note.value = ''; repliedExternally.value = false; reply.value = ''
        cancelMailClose()
        submitErrors.value = {}
    }

    async function open(id: string, preserveDraft = false) {
        const revision = ++detailRevision
        selected.value = id; detailPending.value = true; detailError.value = ''
        if (!preserveDraft) {
            detail.value = null; assignees.value = []; resetDraft()
        }
        try {
            const result = await api.get(id)
            if (revision !== detailRevision) return
            const keepAssignment = preserveDraft && changed.value
            if (keepAssignment) detail.value = result
            else show(result)
            assignees.value = result.assignees
            if (detailStale.value) submitErrors.value = {}
            detailStale.value = false
        } catch (error) {
            if (revision === detailRevision) detailError.value = request.message(error)
        } finally {
            if (revision === detailRevision) {
                detailPending.value = false
                detailVisible.value = true
            }
        }
    }

    function clearDetail() {
        detailRevision++
        selected.value = ''; detail.value = null; assignees.value = []
        resetDraft()
        detailVisible.value = false; detailPending.value = false; busy.value = false; detailError.value = ''; detailStale.value = false
    }

    function leave() {
        listRevision++
        appliedQuery = null
        requestedPage = 1
        list.value = null; loading.value = true; listError.value = ''; warning.value = ''
        clearDetail()
        stopDeliveryPolling()
    }
    watch([identity, canRead], leave, {flush:'sync'})

    function clearDeliveryPollTimer() {
        if (deliveryPollTimer) clearTimeout(deliveryPollTimer)
        deliveryPollTimer = undefined
    }

    function scheduleDeliveryPoll() {
        if (deliveryPollTimer || deliveryPollingPaused.value || !detailVisible.value || !awaitingDelivery.value) return
        deliveryPollTimer = setTimeout(async () => {
            deliveryPollTimer = undefined
            if (deliveryPollingPaused.value || !detailVisible.value || !awaitingDelivery.value) return
            await pollDelivery()
            scheduleDeliveryPoll()
        }, INQUIRY_DELIVERY_POLL_INTERVAL_MS)
    }

    function syncDeliveryPolling() {
        clearDeliveryPollTimer()
        scheduleDeliveryPoll()
    }

    function startDeliveryPolling() {
        deliveryPollingPaused.value = false
        syncDeliveryPolling()
    }

    function stopDeliveryPolling() {
        deliveryPollingPaused.value = true
        clearDeliveryPollTimer()
    }

    watch([detailVisible, awaitingDelivery, deliveryPollingPaused], syncDeliveryPolling)

    async function pollDelivery() {
        if (polling || busy.value || detailPending.value || !awaitingDelivery.value || !selected.value) return
        const revision = detailRevision
        const version = detail.value?.inquiry.version
        polling = true
        try {
            const result = await api.get(selected.value)
            const current = detail.value
            if (revision !== detailRevision || busy.value || !current || current.inquiry.version !== version) return
            detail.value = {...current, mail:result.mail, inquiry:{...current.inquiry, deliveryIssue:result.inquiry.deliveryIssue,
                canWaitForCustomer:result.inquiry.version === version ? result.inquiry.canWaitForCustomer : current.inquiry.canWaitForCustomer}}
        } catch {
            // Silent background refresh; the common request layer handles session recovery.
        } finally { polling = false }
    }

    async function mutate(input: InquiryUpdate, rowAction = false): Promise<AdminOperationResult | null> {
        if (busy.value || detailPending.value || detailStale.value || !detail.value) return null
        const revision = detailRevision, generation = session.generation
        const section = sections[input.action]
        const active = () => revision === detailRevision && generation === session.generation
        busy.value = true; detailError.value = ''; submitErrors.value[section] = ''
        try {
            const result = await api.update(selected.value, input)
            if (!active()) return null
            if (input.action === 'update' || !changed.value) show(result)
            else detail.value = result
            if (input.action === 'note' || input.action === 'external_reply') {note.value = ''; repliedExternally.value = false}
            if (input.action === 'mail_reply') reply.value = ''
            if (input.action === 'mail_close') cancelMailClose()
            const refreshed = appliedQuery
                ? await fetchList(list.value?.page ?? 1, appliedQuery, true)
                : false
            if (!active()) return null
            if (refreshed) return {message:successMessages[input.action], status:'success'}
            warning.value = '操作已保存，但咨询列表刷新失败。请刷新列表，勿重复提交。'
            return null
        } catch (error) {
            if (!active()) return null
            const message = request.operationMessage(error)
            if (!message) return null
            const failure = getAdminRequestFailure(error)
            detailStale.value = failure?.reason === 'STALE'
            if (rowAction) return {message, status:'error'}
            submitErrors.value[section] = failure?.fields?.[0] || message
            return null
        } finally {
            if (active()) busy.value = false
        }
    }

    function saveAssignment(claim = false) {
        const current = detail.value?.inquiry, ownId = session.session?.user?.id
        if (!current || (claim && (!ownId || !canClaim.value))) return
        return mutate({action:'update', version:current.version,
            status:claim ? (current.status === 'pending' ? 'in_progress' : current.status) : nextStatus.value as InquiryStatus,
            assigneeId:claim ? ownId! : assignee.value || null}, claim)
    }

    function saveNote() {
        if (detail.value && note.value.trim())
            return mutate({action:repliedExternally.value ? 'external_reply' : 'note', version:detail.value.inquiry.version, note:note.value})
    }

    function sendReply() {
        if (detail.value && canReply.value && reply.value.trim())
            return mutate({action:'mail_reply', version:detail.value.inquiry.version, body:reply.value})
    }

    function retryMail(id: string) {
        if (detail.value) return mutate({action:'mail_retry', version:detail.value.inquiry.version, deliveryId:id}, true)
    }

    function closeMailIssue() {
        if (detail.value && closingDelivery.value && closeReason.value.trim())
            return mutate({action:'mail_close', version:detail.value.inquiry.version, deliveryId:closingDelivery.value, reason:closeReason.value})
    }

    onScopeDispose(stopDeliveryPolling)

    return {listError, warning, list, loading,
        selected, detail, assignees, detailPending, busy, detailError, detailVisible, detailStale, submitErrors, deliveryPollingPaused,
        nextStatus, assignee, note, repliedExternally, reply, closingDelivery, closeReason, identity, canRead, writable, canAssign, canSend,
        canReply, awaitingDelivery, canClaim, changed, dirty, enter, refreshList, open, clearDetail, leave, pollDelivery,
        startDeliveryPolling, stopDeliveryPolling, saveAssignment, saveNote, sendReply, retryMail, beginMailClose, cancelMailClose, closeMailIssue}
})
