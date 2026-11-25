import type {AdminOperationResult} from '~/types/admin/action-result'
// 后台账号业务状态的唯一入口：列表、创建、编辑草稿、异步动作及进入/离开生命周期。
import {computed, onScopeDispose, reactive, ref, watch} from 'vue'
import {defineStore} from 'pinia'
import type {AdminUserSection, AdminUserListQuery, AdminUserWriteOutcome, AdminUserListMutationOutcome} from '~/types/admin/users'
import type {PageData} from '#shared/types/api'
import type {AccountDictionaryCatalog} from '#shared/types/admin/dictionaries'
import type {PersonalProfile, UserDetail, UserListRecord, UserRecord, UserRoleOption} from '#shared/types/admin/users'
import {personalProfileSchema, userCreateSchema, userResetSchema, userUpdateSchema} from '#shared/schemas/admin/users'
import {createUsersApi} from '~/api/admin/users'
import {useAdminRequestStore} from '~/stores/admin/request'
import type {AccountCreateDraft, AccountCreateTouched} from '~/types/admin/users'
import {useAdminSessionStore} from './session'


const emptyProfileCatalog = (): AccountDictionaryCatalog => ({
    departments: {enabled: false, options: []},
    positions: {enabled: false, options: []},
})

const emptyCreateDraft = (): AccountCreateDraft => ({
    username: '',
    displayName: '',
    email: '',
    phone: '',
    department: '',
    position: '',
    remark: '',
})

const emptyCreateTouched = (): AccountCreateTouched => ({
    username: false,
    displayName: false,
    email: false,
    phone: false,
    department: false,
    position: false,
    remark: false,
})

const emptyEditorForm = () => ({
    displayName: '',
    email: '',
    phone: '',
    department: '',
    position: '',
    remark: '',
    enabled: false,
})

const emptyEditorTouched = () => ({
    displayName: false,
    email: false,
    phone: false,
    department: false,
    position: false,
    remark: false,
})

const emptySectionErrors = () => ({
    profile: '',
    status: '',
    roles: '',
    password: '',
})

export const useAdminUsersStore = defineStore('admin-users', () => {
    const api = useAdminRequestStore()
    const usersApi = createUsersApi(api)
    const session = useAdminSessionStore()

    const personal = reactive({
        data: null as PersonalProfile | null, pending: false, busy: false, error: '',
        form: {displayName: '', email: '', phone: '', department: '', position: ''},
        fieldErrors: {} as Record<string, string>, submitError: '', warning: '',
        feedback: null as AdminOperationResult | null,
    })
    let personalRevision = 0, personalWriteRevision = 0
    const personalDirty = computed(() => !!personal.data && Object.entries(personal.form)
        .some(([key, value]) => value !== (personal.data![key as keyof typeof personal.form] ?? '')))
    function applyPersonal(record: PersonalProfile) {
        personal.data = record
        for (const key of Object.keys(personal.form) as Array<keyof typeof personal.form>)
            personal.form[key] = record[key] ?? ''
        personal.fieldErrors = {}
    }
    function leavePersonal() {
        personalRevision++
        personalWriteRevision++
        personal.data = null
        personal.pending = false
        personal.busy = false
        personal.error = ''
        personal.submitError = ''
        personal.warning = ''
        personal.feedback = null
        personal.fieldErrors = {}
        Object.assign(personal.form, {displayName: '', email: '', phone: '', department: '', position: ''})
    }
    async function loadPersonal() {
        const revision = ++personalRevision, generation = session.generation
        personal.pending = true
        personal.error = ''
        try {
            const record = await usersApi.getPersonalProfile()
            if (revision === personalRevision && generation === session.generation) {
                applyPersonal(record)
                personal.submitError = ''
                personal.warning = ''
            }
        } catch (cause) {
            if (revision === personalRevision && generation === session.generation)
                personal.error = api.message(cause)
        } finally {
            if (revision === personalRevision && generation === session.generation) personal.pending = false
        }
    }
    async function refreshPersonal() {
        await loadPersonal()
        if (personal.error) throw new Error(personal.error)
    }
    async function savePersonal() {
        if (personal.busy || !personal.data || personal.data.isRoot || !personalDirty.value) return
        const parsed = personalProfileSchema.safeParse({version: personal.data.version, ...personal.form,
            email: personal.form.email.trim() || null, phone: personal.form.phone.trim() || null,
            department: personal.form.department.trim() || null, position: personal.form.position.trim() || null})
        personal.fieldErrors = parsed.success ? {} : Object.fromEntries(parsed.error.issues.map(issue => [String(issue.path[0]), issue.message]))
        if (!parsed.success) return
        const revision = personalRevision, write = ++personalWriteRevision, generation = session.generation
        const current = () => revision === personalRevision && generation === session.generation
        personal.busy = true
        personal.submitError = ''
        personal.warning = ''
        personal.feedback = null
        try {
            const record = await usersApi.updatePersonalProfile(parsed.data)
            if (!current()) return
            applyPersonal(record)
            try {
                await api.refreshSession()
                if (current()) personal.feedback = {message: '个人资料已保存。', status: 'success'}
            } catch {
                if (current()) personal.warning = '资料已保存，用户信息刷新失败，请使用顶部刷新重试。'
            }
        } catch (cause) {
            if (current()) personal.submitError = api.operationMessage(cause)
        } finally {
            if (write === personalWriteRevision) personal.busy = false
        }
    }

    const identityVersion = ref(session.generation)
    const writing = ref(false)
    const list = reactive({
        data: null as PageData<UserListRecord> | null,
        pending: false,
        error: '',
        stale: true,
        query: {} as AdminUserListQuery,
        togglingId: '',
        warning: '',
        feedback: null as AdminOperationResult | null,
    })
    const profileCatalog = ref<AccountDictionaryCatalog>(emptyProfileCatalog())
    const profileCatalogPending = ref(false)
    const profileCatalogError = ref('')

    const create = reactive({
        form: emptyCreateDraft(),
        touched: emptyCreateTouched(),
        error: '',
        warning: '',
        createdAccount: null as UserRecord | null,
        feedback: null as AdminOperationResult | null,
    })

    const editor = reactive({
        id: '',
        user: null as UserDetail | null,
        pending: false,
        error: '',
        roles: null as UserRoleOption[] | null,
        rolesPending: false,
        roleError: '',
        form: emptyEditorForm(),
        selected: [] as string[],
        touched: emptyEditorTouched(),
        sectionErrors: emptySectionErrors(),
        warning: '',
        feedback: null as AdminOperationResult | null,
        initialized: false,
    })

    let listRevision = 0
    let editorRevision = 0
    let profileCatalogRevision = 0
    let roleCatalogRevision = 0
    let writeRevision = 0
    let listLoadPromise: Promise<void> | null = null
    let editorLoadPromise: Promise<void> | null = null

    const busy = computed(() => writing.value)
    const editorIsSelf = computed(() => session.session?.user?.id === editor.id)
    const canProfile = computed(() =>
        !editorIsSelf.value && !!editor.user?.actions.profile && session.can('system.users.update'),
    )
    const canRoles = computed(() =>
        !!editor.user?.actions.roles && session.can('system.users.assign_roles'),
    )
    const canReset = computed(() =>
        !!editor.user?.actions.resetPassword && session.can('system.users.reset_password'),
    )
    const canEdit = computed(() =>
        canProfile.value || canRoles.value || canReset.value,
    )
    const pageTitle = computed(() => canEdit.value ? '编辑账号' : '查看账号')
    const createDirty = computed(() => Object.values(create.form).some(value => Boolean(value.trim())))
    const profileDirty = computed(() => {
        const user = editor.user
        return !!user && (
            editor.form.displayName !== user.displayName
            || editor.form.email !== (user.email ?? '')
            || editor.form.phone !== (user.phone ?? '')
            || editor.form.department !== (user.department ?? '')
            || editor.form.position !== (user.position ?? '')
            || editor.form.remark !== (user.remark ?? '')
        )
    })
    const statusDirty = computed(() =>
        !!editor.user && editor.form.enabled !== editor.user.enabled,
    )
    const rolesDirty = computed(() => {
        if (!editor.user)
            return false
        const current = [...editor.selected].sort()
        const baseline = [...editor.user.roleIds].sort()
        return JSON.stringify(current) !== JSON.stringify(baseline)
    })
    const editorDirty = computed(() =>
        profileDirty.value || statusDirty.value || rolesDirty.value,
    )
    const createParsed = computed(() => userCreateSchema.safeParse({
        ...create.form,
        email: create.form.email.trim() || null,
        password: 'placeholder',
    }))
    const createFieldErrors = computed<Record<string, string>>(() =>
        createParsed.value.success
            ? {}
            : Object.fromEntries(
                createParsed.value.error.issues
                    .filter(issue => issue.path[0] !== 'password')
                    .filter(issue => create.touched[issue.path[0] as keyof AccountCreateTouched])
                    .map(issue => [String(issue.path[0]), issue.message]),
            ),
    )
    const editorPayload = computed(() => ({
        version: editor.user?.version ?? 1,
        displayName: editor.form.displayName,
        email: editor.form.email.trim() || null,
        phone: editor.form.phone.trim() || null,
        department: editor.form.department.trim() || null,
        position: editor.form.position.trim() || null,
        remark: editor.form.remark.trim() || null,
    }))
    const editorParsed = computed(() => userUpdateSchema.safeParse(editorPayload.value))
    const editorFieldErrors = computed<Record<string, string>>(() =>
        editorParsed.value.success
            ? {}
            : Object.fromEntries(
                editorParsed.value.error.issues
                    .filter(issue => editor.touched[issue.path[0] as keyof ReturnType<typeof emptyEditorTouched>])
                    .map(issue => [String(issue.path[0]), issue.message]),
            ),
    )
    const roleOptions = computed(() => [
        ...(editor.roles ?? []),
        ...[...new Set([
            ...editor.selected,
            ...(editor.user?.roleIds ?? []),
        ])]
            .filter(roleId => !editor.roles?.some(role => role.id === roleId))
            .map(roleId => ({
                id: roleId,
                name: `未获取角色名称（ID：${roleId}）`,
                enabled: true,
                grantable: false,
            })),
    ])
    const assignedRoles = computed(() =>
        roleOptions.value.filter(role => editor.user?.roleIds.includes(role.id)),
    )
    const creationHint = computed(() => {
        if (editor.user?.roleIds.length)
            return '角色已分配；用户首次登录须修改初始密码。'
        if (canRoles.value)
            return '尚未分配角色。请在下方选择角色并单独保存；创建账号不会自动获得业务权限。'
        return '尚未分配角色。你没有角色分配权限，请联系有权限的管理员完成授权。'
    })

    function canEditRow(row: UserListRecord) {
        return (row.actions.profile && session.can('system.users.update'))
            || (row.actions.roles && session.can('system.users.assign_roles'))
            || (row.actions.resetPassword && session.can('system.users.reset_password'))
    }

    function canToggle(row: UserListRecord) {
        return row.actions.profile
            && session.can('system.users.update')
            && !row.isRoot
            && row.id !== session.session?.user?.id
    }

    function setFeedback(target: {feedback: AdminOperationResult | null}, message: string, status: AdminOperationResult['status'] = 'success') {
        target.feedback = message.trim() ? {message, status} : null
    }

    function clearFeedback(scope: 'list' | 'create' | 'editor') {
        if (scope === 'list')
            list.feedback = null
        else if (scope === 'create')
            create.feedback = null
        else
            editor.feedback = null
    }

    function resetCreate() {
        Object.assign(create, {
            form: emptyCreateDraft(),
            touched: emptyCreateTouched(),
            error: '',
            warning: '',
            createdAccount: null,
            feedback: null,
        })
    }

    function clearEditorState() {
        Object.assign(editor, {
            user: null,
            pending: false,
            error: '',
            roles: null,
            rolesPending: false,
            roleError: '',
            form: emptyEditorForm(),
            selected: [],
            touched: emptyEditorTouched(),
            sectionErrors: emptySectionErrors(),
            warning: '',
            feedback: null,
            initialized: false,
        })
    }

    function applyEditorUser(record: UserDetail) {
        editor.user = record
        Object.assign(editor.form, {
            displayName: record.displayName,
            email: record.email ?? '',
            phone: record.phone ?? '',
            department: record.department ?? '',
            position: record.position ?? '',
            remark: record.remark ?? '',
            enabled: record.enabled,
        })
        editor.selected = [...record.roleIds]
        editor.touched = emptyEditorTouched()
        editor.initialized = true
    }

    function isCurrentIdentity(generation: number) {
        return generation === identityVersion.value
    }

    async function loadProfileCatalog(force = false) {
        if (profileCatalogPending.value && !force)
            return
        const revision = ++profileCatalogRevision
        const generation = identityVersion.value
        profileCatalogPending.value = true
        profileCatalogError.value = ''
        try {
            const catalog = await usersApi.getProfileCatalog()
            if (revision === profileCatalogRevision && isCurrentIdentity(generation))
                profileCatalog.value = catalog
        } catch (error) {
            if (revision === profileCatalogRevision && isCurrentIdentity(generation))
                profileCatalogError.value = api.message(error)
        } finally {
            if (revision === profileCatalogRevision && isCurrentIdentity(generation))
                profileCatalogPending.value = false
        }
    }

    async function loadList(query: AdminUserListQuery, options: {force?: boolean} = {}) {
        if (listLoadPromise && !options.force)
            return listLoadPromise
        const revision = ++listRevision
        const catalogRevision = ++profileCatalogRevision
        const generation = identityVersion.value
        list.query = {...query}
        list.pending = true
        profileCatalogPending.value = true
        list.error = ''
        list.warning = ''
        listLoadPromise = Promise.allSettled([
            usersApi.listUsers(query),
            usersApi.getProfileCatalog(),
        ]).then(([result, catalog]) => {
            if (revision !== listRevision || !isCurrentIdentity(generation))
                return
            if (result.status === 'fulfilled')
                list.data = result.value
            else
                list.error = api.message(result.reason)
            if (catalogRevision === profileCatalogRevision) {
                if (catalog.status === 'fulfilled') {
                    profileCatalog.value = catalog.value
                    profileCatalogError.value = ''
                } else {
                    profileCatalogError.value = api.message(catalog.reason)
                }
                profileCatalogPending.value = false
            }
            list.stale = false
        }).finally(() => {
            if (revision === listRevision && isCurrentIdentity(generation))
                list.pending = false
            if (revision === listRevision)
                listLoadPromise = null
        })
        return listLoadPromise
    }

    async function enterList(query: AdminUserListQuery) {
        const sameQuery = JSON.stringify(list.query) === JSON.stringify(query)
        if (list.pending && sameQuery)
            return listLoadPromise ?? undefined
        if (!list.data || list.stale || !sameQuery)
            await loadList(query, {force: list.pending})
    }

    function leaveList() {
        listRevision++
        listLoadPromise = null
        list.pending = false
        profileCatalogPending.value = false
        list.stale = true
        list.feedback = null
    }

    async function refreshList() {
        await loadList({...list.query}, {force: true})
        if (list.error)
            throw new Error(list.error)
        if (profileCatalogError.value)
            throw new Error(profileCatalogError.value)
    }

    async function toggleEnabled(row: UserListRecord): Promise<AdminUserListMutationOutcome> {
        if (writing.value || list.pending || !canToggle(row))
            return {}
        const revision = ++writeRevision
        const generation = identityVersion.value
        const request = {version: row.version, enabled: !row.enabled}
        writing.value = true
        list.togglingId = row.id
        list.error = ''
        list.warning = ''
        list.feedback = null
        create.createdAccount = null
        try {
            let result: UserRecord
            try {
                result = await usersApi.updateUser(row.id, request)
            } catch (error) {
                if (!isCurrentIdentity(generation))
                    return {}
                setFeedback(list, api.operationMessage(error), 'error')
                return {}
            }
            if (!isCurrentIdentity(generation))
                return {}
            Object.assign(row, result)
            try {
                await loadList({...list.query}, {force: true})
                if (!isCurrentIdentity(generation))
                    return {}
                if (list.error)
                    throw new Error(list.error)
                setFeedback(list, request.enabled ? '账号已启用。' : '账号已禁用。')
                return listFallback()
            } catch (error) {
                if (!isCurrentIdentity(generation))
                    return {}
                list.warning = `状态已保存，但列表刷新失败：${api.message(error)}`
            }
            return {}
        } finally {
            if (revision === writeRevision)
                writing.value = false
            if (revision === writeRevision)
                list.togglingId = ''
        }
    }

    async function remove(row: UserListRecord): Promise<AdminUserListMutationOutcome> {
        if (writing.value || !row.actions.delete || !session.can('system.users.delete'))
            return {}
        const revision = ++writeRevision
        const generation = identityVersion.value
        writing.value = true
        list.error = ''
        list.warning = ''
        list.feedback = null
        create.createdAccount = null
        try {
            try {
                await usersApi.deleteUser(row.id, row.version)
            } catch (error) {
                if (!isCurrentIdentity(generation))
                    return {}
                setFeedback(list, api.operationMessage(error), 'error')
                return {}
            }
            if (!isCurrentIdentity(generation))
                return {}
            try {
                await loadList({...list.query}, {force: true})
                if (!isCurrentIdentity(generation))
                    return {}
                if (list.error)
                    throw new Error(list.error)
                setFeedback(list, '账号已删除，历史记录已保留。')
                return listFallback()
            } catch (error) {
                if (!isCurrentIdentity(generation))
                    return {}
                list.warning = `账号已删除，但列表刷新失败：${api.message(error)}`
            }
            return {}
        } finally {
            if (revision === writeRevision)
                writing.value = false
        }
    }

    function listFallback(): AdminUserListMutationOutcome {
        const page = Number(list.query.page)
        if (list.data && !list.data.items.length && Number.isSafeInteger(page) && page > 1)
            return {fallbackPage: page - 1}
        return {}
    }

    async function createAccount(password: string): Promise<AdminUserWriteOutcome & {created: UserRecord | null}> {
        if (writing.value || !session.can('system.users.create'))
            return {submitted: false, succeeded: false, created: null}
        const revision = ++writeRevision
        const generation = identityVersion.value
        for (const key of Object.keys(create.touched) as Array<keyof AccountCreateTouched>)
            create.touched[key] = true
        create.error = ''
        create.warning = ''
        create.createdAccount = null
        create.feedback = null
        const parsed = userCreateSchema.safeParse({
            ...create.form,
            email: create.form.email.trim() || null,
            phone: create.form.phone.trim() || null,
            department: create.form.department.trim() || null,
            position: create.form.position.trim() || null,
            remark: create.form.remark.trim() || null,
            password,
        })
        if (!parsed.success)
            return {submitted: false, succeeded: false, created: null}
        writing.value = true
        try {
            try {
                create.createdAccount = await usersApi.createUser(parsed.data)
            } catch (error) {
                if (!isCurrentIdentity(generation))
                    return {submitted: true, succeeded: false, created: null}
                create.error = api.operationMessage(error)
                return {submitted: true, succeeded: false, created: null}
            }
            if (!isCurrentIdentity(generation))
                return {submitted: true, succeeded: false, created: null}
            Object.assign(create.form, emptyCreateDraft())
            create.touched = emptyCreateTouched()
            if (!session.can('system.users.read'))
                setFeedback(create, '账号已创建，尚未分配角色，请联系有权限的管理员完成授权。')
            return {submitted: true, succeeded: true, created: create.createdAccount}
        } finally {
            if (revision === writeRevision)
                writing.value = false
        }
    }

    async function loadEditor(id: string, options: {force?: boolean} = {}) {
        if (editorLoadPromise && !options.force && editor.id === id)
            return editorLoadPromise
        const revision = ++editorRevision
        const catalogRevision = ++profileCatalogRevision
        const generation = identityVersion.value
        const changed = editor.id !== id
        editor.id = id
        if (changed)
            clearEditorState()
        editor.id = id
        editor.pending = true
        profileCatalogPending.value = true
        editor.error = ''
        editor.roleError = ''
        editor.warning = ''
        editor.feedback = null
        editorLoadPromise = Promise.allSettled([
            usersApi.getUser(id),
            usersApi.getRoleCatalog(),
            usersApi.getProfileCatalog(),
        ]).then(([userResult, rolesResult, catalogResult]) => {
            if (revision !== editorRevision || editor.id !== id || !isCurrentIdentity(generation))
                return
            if (userResult.status === 'fulfilled') {
                if (!editor.initialized || options.force)
                    applyEditorUser(userResult.value)
                else
                    editor.user = userResult.value
            } else {
                editor.error = api.message(userResult.reason)
            }
            if (rolesResult.status === 'fulfilled')
                editor.roles = rolesResult.value
            else
                editor.roleError = api.message(rolesResult.reason)
            if (catalogRevision === profileCatalogRevision) {
            if (catalogResult.status === 'fulfilled') {
                profileCatalog.value = catalogResult.value
                profileCatalogError.value = ''
            } else {
                    profileCatalogError.value = api.message(catalogResult.reason)
            }
                profileCatalogPending.value = false
            }
        }).finally(() => {
            if (revision === editorRevision && isCurrentIdentity(generation))
                editor.pending = false
            if (revision === editorRevision)
                editorLoadPromise = null
        })
        return editorLoadPromise
    }

    async function refreshEditor() {
        await loadEditor(editor.id, {force: true})
        if (editor.error)
            throw new Error(editor.error)
        if (editor.roleError)
            throw new Error(editor.roleError)
        if (profileCatalogError.value)
            throw new Error(profileCatalogError.value)
    }

    async function refreshRoleCatalog() {
        const revision = ++roleCatalogRevision
        const requestId = editor.id
        const requestEditorRevision = editorRevision
        const generation = identityVersion.value
        editor.rolesPending = true
        editor.roleError = ''
        try {
            const roles = await usersApi.getRoleCatalog()
            if (
                revision === roleCatalogRevision
                && requestId === editor.id
                && requestEditorRevision === editorRevision
                && isCurrentIdentity(generation)
            )
                editor.roles = roles
        } catch (error) {
            if (
                revision === roleCatalogRevision
                && requestId === editor.id
                && requestEditorRevision === editorRevision
                && isCurrentIdentity(generation)
            )
                editor.roleError = api.message(error)
        } finally {
            if (
                revision === roleCatalogRevision
                && requestId === editor.id
                && requestEditorRevision === editorRevision
                && isCurrentIdentity(generation)
            )
                editor.rolesPending = false
        }
    }

    function leaveEditor() {
        editorRevision++
        roleCatalogRevision++
        editorLoadPromise = null
        profileCatalogPending.value = false
        clearEditorState()
        editor.id = ''
    }

    async function saveSection(kind: AdminUserSection, password = ''): Promise<AdminUserWriteOutcome> {
        const user = editor.user
        if (!user || writing.value)
            return {submitted: false, succeeded: false}
        const requestId = editor.id
        const requestEditorRevision = editorRevision
        const requestGeneration = identityVersion.value
        const revision = ++writeRevision
        const isCurrentRequest = () =>
            requestId === editor.id
            && requestEditorRevision === editorRevision
            && isCurrentIdentity(requestGeneration)
        const allowed = kind === 'profile' || kind === 'status'
            ? canProfile.value
            : kind === 'roles'
                ? canRoles.value
                : canReset.value
        if (!allowed || (kind === 'status' && editorIsSelf.value))
            return {submitted: false, succeeded: false}
        if (kind === 'roles' && (editor.roleError || editor.rolesPending || !editor.roles))
            return {submitted: false, succeeded: false}
        if (kind === 'profile') {
            Object.assign(editor.touched, Object.fromEntries(
                Object.keys(editor.touched).map(key => [key, true]),
            ))
            if (!editorParsed.value.success)
                return {submitted: false, succeeded: false}
        }
        if (kind === 'password' && !userResetSchema.safeParse({version: user.version, password}).success) {
            editor.sectionErrors.password = '密码须为 6–128 个字符。'
            return {submitted: false, succeeded: false}
        }
        const submittedRoles = [...editor.selected]
        const request = kind === 'profile'
            ? {...editorPayload.value}
            : kind === 'status'
                ? {version: user.version, enabled: editor.form.enabled}
                : kind === 'roles'
                    ? {version: user.version, roleIds: submittedRoles}
                    : {version: user.version, password}
        editor.sectionErrors[kind] = ''
        editor.warning = ''
        editor.feedback = null
        writing.value = true
        try {
            let result: UserRecord
            try {
                result = await usersApi.updateSection(requestId, kind, request)
            } catch (error) {
                if (!isCurrentRequest())
                    return {submitted: true, succeeded: false}
                editor.sectionErrors[kind] = api.operationMessage(error)
                return {submitted: true, succeeded: false}
            }
            if (!isCurrentRequest())
                return {submitted: true, succeeded: false}
            editor.user = {
                ...editor.user!,
                ...result,
                updatedByName: result.updatedBy === result.id
                    ? result.displayName
                    : session.session?.user?.displayName ?? null,
                ...(kind === 'roles' ? {roleIds: submittedRoles} : {}),
            }
            if (kind === 'profile') {
                Object.assign(editor.form, {
                    displayName: result.displayName,
                    email: result.email ?? '',
                    phone: result.phone ?? '',
                    department: result.department ?? '',
                    position: result.position ?? '',
                    remark: result.remark ?? '',
                })
            }
            if (kind === 'status')
                editor.form.enabled = result.enabled
            if (kind === 'password' || (kind === 'status' && !result.enabled)) {
                editor.user.activeSessionCount = 0
                editor.user.lastActivityAt = null
            }
            try {
                await api.refreshPermissions()
                if (!isCurrentRequest())
                    return {submitted: true, succeeded: false}
                if (!session.can('system.users.read')) {
                    editor.warning = '已保存，但当前账号已失去账号查看权限，请返回账号列表。'
                    return {submitted: true, succeeded: true}
                }
                await refreshRoleCatalog()
                if (!isCurrentRequest())
                    return {submitted: true, succeeded: false}
                if (editor.roleError)
                    throw new Error(editor.roleError)
                setFeedback(
                    editor,
                    kind === 'password'
                        ? '密码已重置，全部会话已撤销；下次登录须改密。'
                        : kind === 'roles'
                            ? '角色分配已保存，后续操作按新授权生效。'
                            : kind === 'status'
                                ? '账号状态已保存。'
                                : '基本信息已保存。',
                )
            } catch {
                if (!isCurrentRequest())
                    return {submitted: true, succeeded: false}
                editor.warning = '已保存，但权限或角色目录刷新失败，请使用顶部刷新重试。'
            }
            return {submitted: true, succeeded: true}
        } finally {
            if (revision === writeRevision)
                writing.value = false
        }
    }

    function clearSectionError(kind: AdminUserSection) {
        editor.sectionErrors[kind] = ''
    }

    function resetForIdentityChange() {
        leavePersonal()
        listRevision++
        editorRevision++
        profileCatalogRevision++
        roleCatalogRevision++
        writeRevision++
        listLoadPromise = null
        editorLoadPromise = null
        identityVersion.value = session.generation
        Object.assign(list, {
            data: null,
            pending: false,
            error: '',
            stale: true,
            query: {},
            togglingId: '',
            warning: '',
            feedback: null,
        })
        profileCatalog.value = emptyProfileCatalog()
        profileCatalogError.value = ''
        profileCatalogPending.value = false
        resetCreate()
        clearEditorState()
        editor.id = ''
        writing.value = false
    }

    watch(() => session.generation, generation => {
        if (generation !== identityVersion.value)
            resetForIdentityChange()
    })
    watch(
        () => [
            editor.form.displayName,
            editor.form.email,
            editor.form.phone,
            editor.form.department,
            editor.form.position,
            editor.form.remark,
        ],
        () => {
            editor.sectionErrors.profile = ''
        },
        {flush: 'sync'},
    )
    watch(() => editor.form.enabled, () => {
        editor.sectionErrors.status = ''
    }, {flush: 'sync'})
    watch(() => [...editor.selected], () => {
        editor.sectionErrors.roles = ''
    }, {flush: 'sync'})
    onScopeDispose(() => {
        leavePersonal()
        listRevision++
        editorRevision++
        profileCatalogRevision++
    })

    return {
        personal, personalDirty, loadPersonal, refreshPersonal, savePersonal, leavePersonal,
        identityVersion,
        busy,
        list,
        profileCatalog,
        profileCatalogPending,
        profileCatalogError,
        create,
        createDirty,
        createFieldErrors,
        editor,
        editorIsSelf,
        canProfile,
        canRoles,
        canReset,
        canEdit,
        pageTitle,
        profileDirty,
        statusDirty,
        rolesDirty,
        editorDirty,
        editorFieldErrors,
        roleOptions,
        assignedRoles,
        creationHint,
        canEditRow,
        canToggle,
        enterList,
        loadList,
        leaveList,
        refreshList,
        toggleEnabled,
        remove,
        resetCreate,
        createAccount,
        loadEditor,
        enterEditor: loadEditor,
        refreshEditor,
        refreshRoleCatalog,
        refreshProfileCatalog: loadProfileCatalog,
        leaveEditor,
        saveSection,
        clearSectionError,
        clearFeedback,
    }
})
