import type {AdminOperationResult} from '~/types/admin/action-result'
// 后台菜单树、页面目录、编辑草稿、排序显示动作及请求生命周期。
import {computed, reactive, ref, watch} from 'vue'
import {defineStore} from 'pinia'

import type {MenuIconKey} from '#shared/types/admin/menus'
import type {MenuPageCatalogItem, MenuRecord} from '#shared/types/admin/menus'
import {menuCreateSchema, menuUpdateSchema} from '#shared/schemas/admin/menus'
import {menuPageOptions} from '~/utils/admin/menus/page-options'
import {createMenusApi} from '~/api/admin/menus'
import {useAdminRequestStore} from '~/stores/admin/request'
import {useAdminSessionStore} from './session'


const emptyForm = () => ({
    iconKey: '' as MenuIconKey | '',
    code: '',
    name: '',
    pageKey: '',
    parentId: '',
    sortOrder: 0,
    visible: true,
})
const emptyTouched = () => ({
    iconKey: false,
    code: false,
    name: false,
    sortOrder: false,
})

export const useAdminMenusStore = defineStore('admin-menus', () => {
    const session = useAdminSessionStore()
    const api = useAdminRequestStore()
    const requests = createMenusApi(api)

    const menus = ref<MenuRecord[] | null>(null)
    const pages = ref<MenuPageCatalogItem[] | null>(null)
    const pending = ref(false)
    const loadError = ref('')
    const catalogError = ref('')
    const busy = ref(false)
    const warning = ref('')
    const feedback = ref<AdminOperationResult | null>(null)
    const stale = ref(true)
    const collapsed = ref<string[]>([])
    const editor = reactive({
        open: false,
        editing: null as MenuRecord | null,
        form: emptyForm(),
        touched: emptyTouched(),
        initial: '',
        error: '',
    })

    let sequence = 0
    let writeRevision = 0
    let loadPromise: Promise<void> | null = null

    const dirty = computed(() =>
        editor.open && JSON.stringify(editor.form) !== editor.initial,
    )
    const writable = computed(() =>
        session.can(editor.editing ? 'system.menus.update' : 'system.menus.create'),
    )
    const payload = computed(() => ({
        iconKey: editor.form.iconKey || undefined,
        name: editor.form.name,
        parentId: editor.form.parentId || null,
        sortOrder: Number(editor.form.sortOrder),
        visible: editor.form.visible,
        ...(editor.editing
            ? {version: editor.editing.version}
            : {code: editor.form.code, pageKey: editor.form.pageKey || null}),
    }))
    const parsed = computed(() =>
        editor.editing
            ? menuUpdateSchema.safeParse(payload.value)
            : menuCreateSchema.safeParse(payload.value),
    )
    const fieldErrors = computed<Record<string, string>>(() =>
        parsed.value.success
            ? {}
            : Object.fromEntries(parsed.value.error.issues
                .filter(issue =>
                    editor.touched[issue.path[0] as keyof typeof editor.touched],
                )
                .map(issue => [String(issue.path[0]), issue.message])),
    )
    const pageOptions = computed(() =>
        menuPageOptions(
            pages.value ?? [],
            menus.value ?? [],
            editor.editing ? editor.form.pageKey || null : undefined,
        ),
    )
    const parentOptions = computed(() => {
        const blocked = new Set(editor.editing ? [editor.editing.id] : [])
        for (let depth = 0; depth < 8; depth++)
            for (const row of menus.value ?? [])
                if (row.parentId && blocked.has(row.parentId))
                    blocked.add(row.id)
        return (menus.value ?? []).filter(row =>
            (row.pageKey === null || row.pageKey === 'website_page') && !blocked.has(row.id),
        )
    })

    function setFeedback(
        message: string,
        status: AdminOperationResult['status'] = 'success',
    ) {
        feedback.value = message.trim() ? {message, status} : null
    }

    async function load(force = false) {
        if (loadPromise && !force)
            return loadPromise
        const requestSequence = ++sequence
        const generation = session.generation
        pending.value = true
        loadError.value = ''
        catalogError.value = ''
        loadPromise = (async () => {
            const [menuResult, pageResult] = await Promise.allSettled([
                requests.listMenus(),
                requests.getPageCatalog(),
            ])
            if (requestSequence !== sequence || generation !== session.generation)
                return
            if (menuResult.status === 'fulfilled')
                menus.value = menuResult.value
            else
                loadError.value = api.message(menuResult.reason)
            if (pageResult.status === 'fulfilled')
                pages.value = pageResult.value
            else
                catalogError.value = api.message(pageResult.reason)
            stale.value = false
        })().finally(() => {
            if (requestSequence === sequence && generation === session.generation)
                pending.value = false
            if (requestSequence === sequence)
                loadPromise = null
        })
        return loadPromise
    }

    async function enter() {
        if (!menus.value || !pages.value || stale.value)
            await load()
    }

    async function refresh() {
        await load(true)
        if (loadError.value)
            throw new Error(loadError.value)
        if (catalogError.value)
            throw new Error(catalogError.value)
    }

    function leave() {
        sequence++
        loadPromise = null
        pending.value = false
        stale.value = true
        feedback.value = null
        editor.open = false
        editor.editing = null
        editor.form = emptyForm()
        editor.touched = emptyTouched()
        editor.initial = ''
        editor.error = ''
    }

    function branchExpanded(id: string, search = '', visibility = '') {
        return !!search || !!visibility || !collapsed.value.includes(id)
    }

    function toggleBranch(id: string) {
        collapsed.value = collapsed.value.includes(id)
            ? collapsed.value.filter(item => item !== id)
            : [...collapsed.value, id]
    }

    function depth(row: MenuRecord) {
        let count = 0, parent = row.parentId
        while (parent && count < 8) {
            count++
            parent = menus.value?.find(item => item.id === parent)?.parentId ?? null
        }
        return count
    }

    function neighbor(row: MenuRecord, direction: 'up' | 'down') {
        const siblings = (menus.value ?? []).filter(item => item.parentId === row.parentId)
        return siblings[siblings.findIndex(item => item.id === row.id)
            + (direction === 'up' ? -1 : 1)]
    }

    function edit(row: MenuRecord | null, website = false) {
        editor.editing = row
        editor.form = {
            iconKey: row?.iconKey ?? (website ? 'file-text' : ''),
            code: row?.code ?? (website ? 'website_' : ''),
            name: row?.name ?? '',
            pageKey: row?.pageKey ?? (website ? 'website_page' : ''),
            parentId: row?.parentId ?? (website ? menus.value?.find(menu=>menu.code==='page_maintenance')?.id ?? '' : ''),
            sortOrder: row?.sortOrder ?? 0,
            visible: row?.visible ?? true,
        }
        editor.touched = emptyTouched()
        editor.initial = JSON.stringify(editor.form)
        editor.error = ''
        editor.open = true
    }

    function closeEditor() {
        editor.open = false
        editor.error = ''
        warning.value = ''
    }

    async function perform(
        work: () => Promise<unknown>,
        successMessage: string,
    ) {
        if (busy.value)
            return false
        const revision = ++writeRevision
        const generation = session.generation
        busy.value = true
        warning.value = ''
        feedback.value = null
        try {
            try {
                await work()
            } catch (error) {
                if (generation === session.generation)
                    setFeedback(api.operationMessage(error), 'error')
                return false
            }
            if (generation !== session.generation)
                return false
            try {
                await refresh()
                if (generation !== session.generation)
                    return false
                setFeedback(successMessage)
            } catch {
                if (generation !== session.generation)
                    return false
                warning.value = successMessage + '但列表刷新失败，请使用顶部刷新重试。'
            }
            return true
        } finally {
            if (revision === writeRevision)
                busy.value = false
        }
    }

    async function updateVisibility(row: MenuRecord, visible: boolean) {
        return perform(
            () => requests.updateMenu(row.id, {
                iconKey: row.iconKey,
                name: row.name,
                parentId: row.parentId,
                sortOrder: row.sortOrder,
                visible,
                version: row.version,
            }),
            visible ? '菜单已显示。' : '菜单已隐藏。',
        )
    }

    async function move(row: MenuRecord, direction: 'up' | 'down') {
        const target = neighbor(row, direction)
        if (!target)
            return false
        return perform(
            () => requests.moveMenu(row.id, {
                version: row.version,
                direction,
                neighborId: target.id,
                neighborVersion: target.version,
            }),
            '菜单顺序已更新。',
        )
    }

    async function remove(row: MenuRecord) {
        return perform(
            () => requests.deleteMenu(row.id, row.version),
            '菜单已删除。',
        )
    }

    async function saveEditor() {
        if (
            busy.value
            || !writable.value
            || catalogError.value
            || loadError.value
            || !menus.value
            || !pages.value
        )
            return {submitted: false, succeeded: false}
        Object.assign(editor.touched, {
            iconKey: true,
            code: true,
            name: true,
            sortOrder: true,
        })
        editor.error = ''
        if (!parsed.value.success)
            return {submitted: false, succeeded: false}
        const revision = ++writeRevision
        const generation = session.generation
        const editingId = editor.editing?.id ?? null
        busy.value = true
        warning.value = ''
        try {
            await (editor.editing
                ? requests.updateMenu(editor.editing.id, menuUpdateSchema.parse(parsed.value.data))
                : requests.createMenu(menuCreateSchema.parse(parsed.value.data)))
            if (generation !== session.generation)
                return {submitted: true, succeeded: false}
            if (editingId !== (editor.editing?.id ?? null))
                return {submitted: true, succeeded: false}
            editor.initial = JSON.stringify(editor.form)
            editor.open = false
            try {
                await refresh()
                await api.refreshPermissions()
                if (
                    generation !== session.generation
                    || editingId !== (editor.editing?.id ?? null)
                )
                    return {submitted: true, succeeded: false}
                setFeedback('菜单已保存。')
            } catch (error) {
                if (
                    generation !== session.generation
                    || editingId !== (editor.editing?.id ?? null)
                )
                    return {submitted: true, succeeded: false}
                warning.value = `菜单已保存，但列表或导航权限刷新失败：${api.message(error)}`
            }
            return {submitted: true, succeeded: true}
        } catch (error) {
            if (generation === session.generation)
                editor.error = api.operationMessage(error)
            return {submitted: true, succeeded: false}
        } finally {
            if (revision === writeRevision)
                busy.value = false
        }
    }

    function resetForIdentityChange() {
        sequence++
        writeRevision++
        loadPromise = null
        menus.value = null
        pages.value = null
        pending.value = false
        busy.value = false
        loadError.value = ''
        catalogError.value = ''
        warning.value = ''
        feedback.value = null
        stale.value = true
        collapsed.value = []
        editor.open = false
        editor.editing = null
        editor.form = emptyForm()
        editor.touched = emptyTouched()
        editor.initial = ''
        editor.error = ''
    }

    watch(() => session.generation, resetForIdentityChange)
    watch(
        () => [
            editor.form.iconKey,
            editor.form.code,
            editor.form.name,
            editor.form.sortOrder,
            editor.form.pageKey,
            editor.form.parentId,
            editor.form.visible,
        ],
        () => {
            editor.error = ''
        },
    )

    return {
        menus,
        pages,
        pending,
        loadError,
        catalogError,
        busy,
        warning,
        feedback,
        stale,
        collapsed,
        editor,
        dirty,
        writable,
        payload,
        parsed,
        fieldErrors,
        pageOptions,
        parentOptions,
        load,
        enter,
        refresh,
        leave,
        branchExpanded,
        toggleBranch,
        depth,
        neighbor,
        edit,
        closeEditor,
        updateVisibility,
        move,
        remove,
        saveEditor,
    }
})
