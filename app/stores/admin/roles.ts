import type {AdminOperationResult} from '~/types/admin/action-result'
// 后台角色的列表、详情、资料草稿、联合授权草稿及请求生命周期。
import {computed, onScopeDispose, reactive, ref, watch} from 'vue'
import {defineStore} from 'pinia'
import type {AdminRoleQuery, AdminRoleListMutation} from '~/types/admin/roles'
import type {PageData} from '#shared/types/api'
import type {RoleDetail, RoleListRecord, RolePermission} from '#shared/types/admin/roles'
import type {RoleMenuData, RoleMenuOption} from '#shared/types/admin/menus'
import {roleCreateSchema, roleFieldsSchema} from '#shared/schemas/admin/roles'
import {createRolesApi} from '~/api/admin/roles'
import {useAdminRequestStore} from '~/stores/admin/request'
import {
    permissionBatchState,
    togglePermissionBatch,
} from '~/utils/admin/roles/permission-groups'
import {
    removableMenuPermissions,
    requiredMenuPermissions,
} from '~/utils/admin/roles/authorization'
import {reconcileMenuSelection} from '~/utils/admin/roles/menu-selection'
import {useAdminSessionStore} from './session'


const emptyListForm = () => ({code: '', name: '', enabled: true})
const emptyListTouched = () => ({code: false, name: false})
const emptyEditorForm = () => ({name: '', enabled: false})

export const useAdminRolesStore = defineStore('admin-roles', () => {
    const api = useAdminRequestStore()
    const requests = createRolesApi(api)
    const session = useAdminSessionStore()
    const identityVersion = ref(session.generation)

    const list = reactive({
        data: null as PageData<RoleListRecord> | null,
        pending: false,
        busy: false,
        error: '',
        stale: true,
        query: {} as AdminRoleQuery,
        form: emptyListForm(),
        touched: emptyListTouched(),
        createError: '',
        createdRole: null as {id: string} | null,
        warning: '',
        feedback: null as AdminOperationResult | null,
    })
    const editor = reactive({
        id: '',
        role: null as RoleDetail | null,
        pending: false,
        error: '',
        catalog: null as RolePermission[] | null,
        catalogPending: false,
        catalogError: '',
        form: emptyEditorForm(),
        selected: [] as string[],
        nameTouched: false,
        busy: false,
        submitError: '',
        warning: '',
        feedback: null as AdminOperationResult | null,
        menus: null as RoleMenuData | null,
        menusPending: false,
        menusError: '',
        menuIds: [] as string[],
        menuBaseline: [] as string[],
        menusInitialized: false,
        removingId: '',
        menusDirty: false,
        initialized: false,
    })

    let listRevision = 0
    let editorRevision = 0
    let catalogRevision = 0
    let authorizationRevision = 0
    let listPromise: Promise<void> | null = null
    let editorPromise: Promise<void> | null = null
    let writeRevision = 0

    const listFieldErrors = computed<Record<string, string>>(() => {
        const parsed = roleCreateSchema.safeParse(list.form)
        if (parsed.success)
            return {}
        return Object.fromEntries(parsed.error.issues
            .filter(issue => list.touched[issue.path[0] as keyof typeof list.touched])
            .map(issue => [String(issue.path[0]), issue.message]))
    })
    const listDirty = computed(() =>
        !!list.form.code || !!list.form.name || !list.form.enabled,
    )
    const visibleCatalog = computed(() => [
        ...(editor.catalog ?? []),
        ...(editor.role?.permissions ?? [])
            .filter(code => !editor.catalog?.some(item => item.code === code))
            .map(code => ({
                code,
                name: '已废弃目录权限',
                available: false,
                grantable: false,
            })),
    ])
    const nameError = computed(() => {
        const parsed = roleFieldsSchema.shape.name.safeParse(editor.form.name)
        return editor.nameTouched && !parsed.success
            ? parsed.error.issues[0]?.message ?? ''
            : ''
    })
    const metadataDirty = computed(() =>
        !!editor.role && (
            editor.form.name !== editor.role.name
            || editor.form.enabled !== editor.role.enabled
        ),
    )
    const permissionsDirty = computed(() => {
        if (!editor.role)
            return false
        const selected = [...editor.selected].sort()
        const baseline = [...editor.role.permissions].sort()
        return JSON.stringify(selected) !== JSON.stringify(baseline)
    })
    const menuDirty = computed(() => {
        const selected = [...editor.menuIds].sort()
        const baseline = [...editor.menuBaseline].sort()
        return JSON.stringify(selected) !== JSON.stringify(baseline)
    })
    const editorDirty = computed(() =>
        metadataDirty.value || permissionsDirty.value || menuDirty.value,
    )
    const authorizationDirty = computed(() =>
        permissionsDirty.value || menuDirty.value,
    )
    const withinScope = computed(() =>
        session.isRoot
        || (editor.role?.permissions ?? []).every(code =>
            editor.catalog?.some(item => item.code === code && item.grantable),
        ),
    )
    const canEditCode = (code: string) =>
        !editor.error && session.can(code) && withinScope.value
    const editable = computed(() =>
        canEditCode('system.roles.update')
        || canEditCode('system.roles.assign_permissions')
        || canEditCode('system.roles.assign_menus'),
    )
    const authorizationOptions = computed(() => editor.menus?.items ?? [])
    const authorizationInScope = computed(() =>
        session.isRoot
        || editor.menuBaseline.every(id =>
            authorizationOptions.value.some(item => item.id === id && item.grantable),
        ),
    )
    const authorizationReady = computed(() =>
        !editor.busy
        && !!editor.role
        && !editor.pending
        && !editor.error
        && !!editor.catalog
        && !editor.catalogPending
        && !editor.catalogError
        && !!editor.menus
        && !editor.menusPending
        && !editor.menusError
        && withinScope.value,
    )
    const canMenus = computed(() =>
        authorizationReady.value
        && authorizationInScope.value
        && session.can('system.roles.assign_menus'),
    )
    const canPermissions = computed(() =>
        authorizationReady.value
        && session.can('system.roles.assign_permissions'),
    )
    const requiredPermissions = computed(() =>
        requiredMenuPermissions(authorizationOptions.value, editor.menuIds),
    )
    const missingPermissions = computed(() =>
        requiredPermissions.value.filter(code => !editor.selected.includes(code)),
    )
    const removing = computed(() =>
        authorizationOptions.value.find(item => item.id === editor.removingId) ?? null,
    )
    const removable = computed(() => removing.value
        ? removableMenuPermissions(
            removing.value,
            authorizationOptions.value,
            editor.menuIds.filter(id => id !== removing.value!.id),
            editor.catalog ?? [],
            editor.selected,
        )
        : [],
    )
    const permissionGroups = computed(() => {
        const result = new Map<string, {
            key: string
            names: string[]
            items: RolePermission[]
        }>()
        for (const item of authorizationOptions.value.filter(item =>
            item.pageKey && editor.menuIds.includes(item.id),
        )) {
            const key = item.pageKey!
            if (result.has(key)) {
                result.get(key)!.names.push(item.name)
                continue
            }
            result.set(key, {
                key,
                names: [item.name],
                items: (editor.catalog ?? []).filter(permission =>
                    (item.operations ?? []).includes(permission.code)
                    && !requiredPermissions.value.includes(permission.code)
                    && (permission.available || editor.selected.includes(permission.code)),
                ),
            })
        }
        return [...result.values()].filter(group => group.items.length)
    })

    function setFeedback(
        target: {feedback: AdminOperationResult | null},
        message: string,
        status: AdminOperationResult['status'] = 'success',
    ) {
        target.feedback = message.trim() ? {message, status} : null
    }

    function resetListForm() {
        list.form = emptyListForm()
        list.touched = emptyListTouched()
        list.createError = ''
    }

    function clearEditor() {
        Object.assign(editor, {
            role: null,
            pending: false,
            error: '',
            catalog: null,
            catalogPending: false,
            catalogError: '',
            form: emptyEditorForm(),
            selected: [],
            nameTouched: false,
            busy: false,
            submitError: '',
            warning: '',
            feedback: null,
            menus: null,
            menusPending: false,
            menusError: '',
            menuIds: [],
            menuBaseline: [],
            menusInitialized: false,
            removingId: '',
            menusDirty: false,
            initialized: false,
        })
    }

    function applyRole(record: RoleDetail) {
        editor.role = record
        editor.form = {name: record.name, enabled: record.enabled}
        editor.selected = [...record.permissions]
        editor.nameTouched = false
        editor.initialized = true
    }

    function syncMenus(force = false) {
        if (!editor.menus)
            return
        const next = force
            ? {
                selected: [...editor.menus.menuIds],
                baseline: [...editor.menus.menuIds],
                initialized: true,
            }
            : reconcileMenuSelection({
                selected: editor.menuIds,
                baseline: editor.menuBaseline,
                initialized: editor.menusInitialized,
            }, editor.menus.menuIds)
        editor.menuIds = next.selected
        editor.menuBaseline = next.baseline
        editor.menusInitialized = next.initialized
    }

    function isCurrent(generation: number) {
        return generation === session.generation
    }

    function isCurrentEditorRequest(
        id: string,
        revision: number,
        generation: number,
    ) {
        return id === editor.id
            && revision === editorRevision
            && isCurrent(generation)
    }

    async function loadList(query: AdminRoleQuery, force = false) {
        if (listPromise && !force && JSON.stringify(list.query) === JSON.stringify(query))
            return listPromise
        const revision = ++listRevision
        const generation = session.generation
        list.query = {...query}
        list.pending = true
        list.error = ''
        list.warning = ''
        listPromise = (async () => {
            try {
                const result = await requests.listRoles(query)
                if (revision === listRevision && isCurrent(generation)) {
                    list.data = result
                    list.stale = false
                }
            } catch (error) {
                if (revision === listRevision && isCurrent(generation))
                    list.error = api.message(error)
            } finally {
                if (revision === listRevision && isCurrent(generation))
                    list.pending = false
                if (revision === listRevision)
                    listPromise = null
            }
        })()
        return listPromise
    }

    async function enterList(query: AdminRoleQuery) {
        if (list.pending && JSON.stringify(list.query) === JSON.stringify(query))
            return listPromise ?? undefined
        if (!list.data || list.stale || JSON.stringify(list.query) !== JSON.stringify(query))
            await loadList(query, list.pending)
    }

    function leaveList() {
        listRevision++
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

    async function createRole() {
        if (list.busy || !session.can('system.roles.create'))
            return null
        Object.assign(list.touched, {code: true, name: true})
        list.createError = ''
        const parsed = roleCreateSchema.safeParse(list.form)
        if (!parsed.success)
            return null
        const revision = ++writeRevision
        const generation = session.generation
        list.busy = true
        try {
            const created = await requests.createRole({...parsed.data})
            if (!isCurrent(generation))
                return null
            list.createdRole = created
            resetListForm()
            return created
        } catch (error) {
            if (isCurrent(generation))
                list.createError = api.operationMessage(error)
            return null
        } finally {
            if (revision === writeRevision) {
                list.busy = false
            }
        }
    }

    async function removeRole(row: RoleListRecord): Promise<AdminRoleListMutation> {
        if (list.busy || !session.can('system.roles.delete'))
            return {}
        const revision = ++writeRevision
        const generation = session.generation
        list.busy = true
        list.createError = ''
        list.warning = ''
        list.createdRole = null
        try {
            try {
                await requests.deleteRole(row.id, row.version)
            } catch (error) {
                if (isCurrent(generation))
                    setFeedback(list, api.operationMessage(error), 'error')
                return {}
            }
            if (!isCurrent(generation))
                return {}
            try {
                await loadList({...list.query}, true)
                if (!isCurrent(generation))
                    return {}
                if (list.error)
                    throw new Error(list.error)
                setFeedback(list, '角色已删除。')
                const page = Number(list.query.page)
                if (list.data && !list.data.items.length && Number.isSafeInteger(page) && page > 1)
                    return {fallbackPage: page - 1}
            } catch (error) {
                if (isCurrent(generation))
                    list.warning = `角色已删除，但列表刷新失败：${api.message(error)}`
            }
            return {}
        } finally {
            if (revision === writeRevision)
                list.busy = false
        }
    }

    async function loadEditor(id: string, force = false) {
        if (editorPromise && !force && editor.id === id)
            return editorPromise
        const revision = ++editorRevision
        const generation = session.generation
        const changed = editor.id !== id
        editor.id = id
        if (changed)
            clearEditor()
        editor.id = id
        editor.pending = true
        editor.error = ''
        editor.catalogPending = true
        editor.catalogError = ''
        editor.menusPending = true
        editor.menusError = ''
        editor.warning = ''
        editor.feedback = null
        editorPromise = (async () => {
            const [roleResult, catalogResult, menusResult] = await Promise.allSettled([
                requests.getRole(id),
                requests.getPermissionCatalog(),
                requests.getRoleMenus(id),
            ])
            if (revision !== editorRevision || editor.id !== id || !isCurrent(generation))
                return
            if (roleResult.status === 'fulfilled') {
                if (!editor.initialized || force)
                    applyRole(roleResult.value)
                else
                    editor.role = roleResult.value
            } else {
                editor.error = api.message(roleResult.reason)
            }
            if (catalogResult.status === 'fulfilled')
                editor.catalog = catalogResult.value
            else
                editor.catalogError = api.message(catalogResult.reason)
            if (menusResult.status === 'fulfilled') {
                editor.menus = menusResult.value
                syncMenus(force)
            } else {
                editor.menusError = api.message(menusResult.reason)
            }
        })().finally(() => {
            if (revision === editorRevision && isCurrent(generation)) {
                editor.pending = false
                editor.catalogPending = false
                editor.menusPending = false
            }
            if (revision === editorRevision)
                editorPromise = null
        })
        return editorPromise
    }

    async function enterEditor(id: string) {
        await loadEditor(id)
    }

    async function refreshEditor() {
        await loadEditor(editor.id, true)
        if (editor.error)
            throw new Error(editor.error)
        if (editor.catalogError)
            throw new Error(editor.catalogError)
        if (editor.menusError)
            throw new Error(editor.menusError)
    }

    async function refreshCatalog() {
        const revision = ++catalogRevision
        const requestId = editor.id
        const requestEditorRevision = editorRevision
        const generation = session.generation
        editor.catalogPending = true
        editor.catalogError = ''
        try {
            const catalog = await requests.getPermissionCatalog()
            if (isCurrentEditorRequest(requestId, requestEditorRevision, generation))
                editor.catalog = catalog
        } catch (error) {
            if (isCurrentEditorRequest(requestId, requestEditorRevision, generation))
                editor.catalogError = api.message(error)
        } finally {
            if (
                revision === catalogRevision
                && isCurrentEditorRequest(requestId, requestEditorRevision, generation)
            )
                editor.catalogPending = false
        }
    }

    async function refreshAuthorization() {
        const revision = ++authorizationRevision
        const requestId = editor.id
        const requestEditorRevision = editorRevision
        const generation = session.generation
        const isCurrentRequest = () =>
            revision === authorizationRevision
            && isCurrentEditorRequest(requestId, requestEditorRevision, generation)
        editor.menusPending = true
        editor.menusError = ''
        try {
            const menus = await requests.getRoleMenus(requestId)
            if (!isCurrentRequest())
                return
            editor.menus = menus
            syncMenus(true)
        } catch (error) {
            if (isCurrentRequest())
                editor.menusError = api.message(error)
        } finally {
            if (isCurrentRequest())
                editor.menusPending = false
        }
    }

    function leaveEditor() {
        editorRevision++
        catalogRevision++
        authorizationRevision++
        editorPromise = null
        clearEditor()
        editor.id = ''
    }

    function repairRequiredPermissions() {
        if (
            !missingPermissions.value.length
            || !canPermissions.value
            || missingPermissions.value.some(code =>
                !(editor.catalog ?? []).some(item =>
                    item.code === code && item.available && item.grantable,
                ),
            )
        )
            return
        editor.selected = [...new Set([...editor.selected, ...missingPermissions.value])]
    }

    function selectionBlocked(item: RoleMenuOption) {
        if (!canMenus.value)
            return ''
        if (
            !editor.menuIds.includes(item.id)
            && item.permission
            && !editor.selected.includes(item.permission)
            && (
                !canPermissions.value
                || !(editor.catalog ?? []).some(permission =>
                    permission.code === item.permission
                    && permission.grantable
                    && permission.available,
                )
            )
        )
            return '无权授予此页面所需的权限'
        if (
            editor.menuIds.includes(item.id)
            && !canPermissions.value
            && removableMenuPermissions(
                item,
                authorizationOptions.value,
                editor.menuIds.filter(id => id !== item.id),
                editor.catalog ?? [],
                editor.selected,
            ).length
        )
            return '取消此页面需要操作权限分配权'
        return ''
    }

    function prepareMenuToggle(item: RoleMenuOption, checked: boolean) {
        if (!canMenus.value || editor.removingId)
            return {allowed: false, needsConfirmation: false}
        if (checked) {
            if (!item.grantable)
                return {allowed: false, needsConfirmation: false}
            if (item.permission && !editor.selected.includes(item.permission)) {
                if (
                    !canPermissions.value
                    || !(editor.catalog ?? []).some(permission =>
                        permission.code === item.permission
                        && permission.grantable
                        && permission.available,
                    )
                ) {
                    setFeedback(editor, '请先取得分配此页面查看权限的授权。', 'warning')
                    return {allowed: false, needsConfirmation: false}
                }
                editor.selected = [...new Set([...editor.selected, item.permission])]
            }
            editor.menuIds = [...new Set([...editor.menuIds, item.id])]
            return {allowed: true, needsConfirmation: false}
        }
        editor.removingId = item.id
        if (removable.value.length && !canPermissions.value) {
            editor.removingId = ''
            setFeedback(editor, '取消此页面需要同时调整操作权限，请联系有权分配操作权限的管理员。', 'warning')
            return {allowed: false, needsConfirmation: false}
        }
        const optional = removable.value.filter(code => code !== item.permission)
        if (optional.length)
            return {allowed: false, needsConfirmation: true, item}
        commitMenuRemoval()
        return {allowed: true, needsConfirmation: false}
    }

    function commitMenuRemoval() {
        const item = removing.value
        if (!item)
            return
        const codes = new Set(removable.value)
        editor.selected = editor.selected.filter(code => !codes.has(code))
        editor.menuIds = editor.menuIds.filter(id => id !== item.id)
        editor.removingId = ''
    }

    function cancelMenuRemoval() {
        editor.removingId = ''
    }

    function toggleDashboard(checked: boolean) {
        if (!canPermissions.value)
            return
        if (
            !(editor.catalog ?? []).some(item =>
                item.code === 'system.dashboard.read'
                && item.grantable
                && item.available,
            )
        )
            return
        editor.selected = checked
            ? [...new Set([...editor.selected, 'system.dashboard.read'])]
            : editor.selected.filter(code => code !== 'system.dashboard.read')
    }

    function toggleBatch(items: RolePermission[], checked: boolean) {
        if (!canPermissions.value)
            return
        editor.selected = togglePermissionBatch(
            items.filter(item => !requiredPermissions.value.includes(item.code)),
            editor.selected,
            checked,
        )
    }

    function batchState(items: RolePermission[]) {
        return permissionBatchState(
            items.filter(item => !requiredPermissions.value.includes(item.code)),
            editor.selected,
        )
    }

    async function saveMetadata() {
        if (!editor.role || editor.busy || !canEditCode('system.roles.update'))
            return {submitted: false, succeeded: false}
        editor.nameTouched = true
        if (!roleFieldsSchema.safeParse(editor.form).success)
            return {submitted: false, succeeded: false}
        const requestId = editor.id
        const requestRevision = editorRevision
        const generation = session.generation
        const revision = ++writeRevision
        editor.busy = true
        editor.submitError = ''
        editor.warning = ''
        try {
            const current = editor.role
            const result = await requests.updateRole(requestId, {
                version: current.version,
                name: editor.form.name,
                enabled: editor.form.enabled,
            })
            if (
                requestId !== editor.id
                || requestRevision !== editorRevision
                || !isCurrent(generation)
            )
                return {submitted: true, succeeded: false}
            editor.role = {
                ...editor.role!,
                version: result.version,
                name: editor.form.name.trim(),
                enabled: editor.form.enabled,
            }
            editor.form.name = editor.role.name
            try {
                await api.refreshPermissions()
                if (!isCurrentEditorRequest(requestId, requestRevision, generation))
                    return {submitted: true, succeeded: false}
                if (!session.can('system.roles.read')) {
                    editor.warning = '已保存，但当前账号已失去角色查看权限。请返回角色列表。'
                    return {submitted: true, succeeded: true}
                }
                await refreshCatalog()
                if (!isCurrentEditorRequest(requestId, requestRevision, generation))
                    return {submitted: true, succeeded: false}
                if (editor.catalogError)
                    throw new Error(editor.catalogError)
                setFeedback(editor, '角色基本信息已保存。')
            } catch {
                if (!isCurrentEditorRequest(requestId, requestRevision, generation))
                    return {submitted: true, succeeded: false}
                editor.warning = '已保存，但权限或权限目录刷新失败，请使用顶部刷新重试。'
            }
            return {submitted: true, succeeded: true}
        } catch (error) {
            if (
                requestId === editor.id
                && requestRevision === editorRevision
                && isCurrent(generation)
            )
                editor.submitError = api.operationMessage(error)
            return {submitted: true, succeeded: false}
        } finally {
            if (revision === writeRevision)
                editor.busy = false
        }
    }

    async function saveAuthorization() {
        if (
            !authorizationReady.value
            || !authorizationDirty.value
            || missingPermissions.value.length
            || (menuDirty.value && !canMenus.value)
            || (permissionsDirty.value && !canPermissions.value)
        )
            return {submitted: false, succeeded: false}
        const requestId = editor.id
        const requestRevision = editorRevision
        const generation = session.generation
        const revision = ++writeRevision
        const submittedMenus = [...editor.menuIds]
        const submittedPermissions = [...editor.selected]
        editor.submitError = ''
        editor.warning = ''
        editor.busy = true
        try {
            const result = await requests.assignAuthorization(requestId, {
                version: editor.role!.version,
                menuIds: submittedMenus,
                permissions: submittedPermissions,
            })
            if (
                requestId !== editor.id
                || requestRevision !== editorRevision
                || !isCurrent(generation)
            )
                return {submitted: true, succeeded: false}
            editor.menuBaseline = [...submittedMenus]
            editor.role = {
                ...editor.role!,
                version: result.version,
                permissions: submittedPermissions,
            }
            try {
                await api.refreshPermissions()
                if (!isCurrentEditorRequest(requestId, requestRevision, generation))
                    return {submitted: true, succeeded: false}
                await refreshAuthorization()
                if (!isCurrentEditorRequest(requestId, requestRevision, generation))
                    return {submitted: true, succeeded: false}
                if (editor.menusError)
                    throw new Error(editor.menusError)
                setFeedback(editor, '页面菜单和操作权限已保存。')
            } catch {
                if (requestId !== editor.id || !isCurrent(generation))
                    return {submitted: true, succeeded: false}
                editor.warning = '已保存，但授权目录刷新失败，请使用顶部刷新重试。'
            }
            return {submitted: true, succeeded: true}
        } catch (error) {
            if (
                requestId === editor.id
                && requestRevision === editorRevision
                && isCurrent(generation)
            )
                editor.submitError = api.operationMessage(error)
            return {submitted: true, succeeded: false}
        } finally {
            if (revision === writeRevision)
                editor.busy = false
        }
    }

    function resetForIdentityChange() {
        listRevision++
        editorRevision++
        catalogRevision++
        authorizationRevision++
        writeRevision++
        identityVersion.value = session.generation
        listPromise = null
        editorPromise = null
        Object.assign(list, {
            data: null,
            pending: false,
            error: '',
            stale: true,
            query: {},
            form: emptyListForm(),
            touched: emptyListTouched(),
            createError: '',
            createdRole: null,
            warning: '',
            feedback: null,
            busy: false,
        })
        clearEditor()
        editor.id = ''
    }

    watch(() => session.generation, generation => {
        if (generation !== identityVersion.value)
            resetForIdentityChange()
    })
    watch(() => editor.form.name, () => {
        editor.submitError = ''
    })
    watch([() => editor.form.enabled, () => editor.selected], () => {
        editor.submitError = ''
    }, {deep: true})
    watch(
        [requiredPermissions, canPermissions, () => editor.catalog],
        () => repairRequiredPermissions(),
        {immediate: true},
    )
    watch(menuDirty, value => {
        editor.menusDirty = value
    }, {immediate: true})
    onScopeDispose(() => {
        listRevision++
        editorRevision++
        writeRevision++
    })

    return {
        list,
        listFieldErrors,
        listDirty,
        editor,
        visibleCatalog,
        nameError,
        metadataDirty,
        permissionsDirty,
        menuDirty,
        editorDirty,
        authorizationDirty,
        withinScope,
        canEdit: canEditCode,
        editable,
        authorizationOptions,
        authorizationInScope,
        authorizationReady,
        canMenus,
        canPermissions,
        requiredPermissions,
        missingPermissions,
        removing,
        removable,
        permissionGroups,
        loadList,
        enterList,
        leaveList,
        refreshList,
        resetListForm,
        createRole,
        removeRole,
        loadEditor,
        enterEditor,
        refreshEditor,
        refreshCatalog,
        refreshAuthorization,
        leaveEditor,
        selectionBlocked,
        prepareMenuToggle,
        commitMenuRemoval,
        cancelMenuRemoval,
        toggleDashboard,
        toggleBatch,
        batchState,
        saveMetadata,
        saveAuthorization,
    }
})
