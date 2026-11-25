import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import type { UserDetail, UserListRecord } from '../../shared/types/admin/users'

const dependencies = vi.hoisted(() => ({
  refreshSession: vi.fn(),
  api: {

    message: vi.fn((error: unknown) => error instanceof Error ? error.message : '请求失败'),
    operationMessage: vi.fn((error: unknown) => error instanceof Error ? error.message : '操作失败'),
    refreshPermissions: vi.fn(async () => {})
  },
  users: {
    listUsers: vi.fn(),
    getUser: vi.fn(),
    getRoleCatalog: vi.fn(),
    getProfileCatalog: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    updateSection: vi.fn(),
    deleteUser: vi.fn(),
    getPersonalProfile: vi.fn(),
    updatePersonalProfile: vi.fn()
  }
}))

vi.mock('~/stores/admin/request', () => ({
  useAdminRequestStore: () => ({...dependencies.api, refreshSession: dependencies.refreshSession})
}))
vi.mock('~/api/admin/users', () => ({
  createUsersApi: () => dependencies.users
}))
import { useAdminUsersStore } from '../../app/stores/admin/users'
import { useAdminSessionStore } from '../../app/stores/admin/session'

const profileCatalog = {
  departments: {
    enabled: true,
    options: [{ id: '1', code: 'maintenance', name: '维护组', enabled: true }]
  },
  positions: {
    enabled: true,
    options: [{ id: '2', code: 'operator', name: '运维', enabled: true }]
  }
}

const user = (overrides: Partial<UserDetail> = {}): UserDetail => ({
  id: '20',
  username: 'target',
  displayName: 'Target',
  email: null,
  phone: null,
  department: null,
  position: null,
  remark: null,
  enabled: true,
  isRoot: false,
  mustChangePassword: true,
  version: 1,
  createdBy: '1',
  updatedBy: '1',
  createdAt: '2026-10-23T00:00:00Z',
  updatedAt: '2026-10-23T00:00:00Z',
  deletedAt: null,
  roles: [{ id: '10', name: 'Role A', enabled: true }],
  lastLoginAt: null,
  activeSessionCount: 0,
  lastActivityAt: null,
  roleIds: ['10'],
  manageable: true,
  createdByName: 'Root',
  updatedByName: 'Root',
  actions: { profile: true, roles: true, resetPassword: true, delete: true },
  ...overrides
})

const listPage = (items: UserListRecord[] = [user()]) => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 20
})

beforeEach(() => {
  dependencies.refreshSession.mockReset().mockResolvedValue(undefined)
  dependencies.users.getPersonalProfile.mockReset()
  dependencies.users.updatePersonalProfile.mockReset()
  setActivePinia(createPinia())
  const session = useAdminSessionStore()
  session.acceptSession({
    authenticated: true,
    mustChangePassword: false,
    user: { id: '1', username: 'root', displayName: 'Root', isRoot: true },
    csrfToken: 'csrf'
  }, session.generation)
  session.acceptPermissions({isRoot: true, permissions: [], version: 'p1'}, session.generation)
  dependencies.api.refreshPermissions.mockClear()
  dependencies.users.listUsers.mockReset()
  dependencies.users.getUser.mockReset()
  dependencies.users.getRoleCatalog.mockReset()
  dependencies.users.getProfileCatalog.mockReset()
  dependencies.users.createUser.mockReset()
  dependencies.users.updateUser.mockReset()
  dependencies.users.updateSection.mockReset()
  dependencies.users.deleteUser.mockReset()
  dependencies.users.listUsers.mockResolvedValue(listPage())
  dependencies.users.getUser.mockResolvedValue(user())
  dependencies.users.getRoleCatalog.mockResolvedValue([
    { id: '10', name: 'Role A', enabled: true, grantable: true },
    { id: '11', name: 'Role B', enabled: true, grantable: true }
  ])
  dependencies.users.getProfileCatalog.mockResolvedValue(profileCatalog)
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

describe('账号业务 Pinia store', () => {
  it('权限撤销后直接按身份 store 阻止账号写入', async () => {
    const store = useAdminUsersStore(), session = useAdminSessionStore()
    await store.enterList({})
    const row = store.list.data!.items[0]!
    session.acceptPermissions({isRoot: false, permissions: ['system.users.read'], version: 'revoked'}, session.generation)
    await store.toggleEnabled(row)
    await store.remove(row)
    expect(store.canToggle(row)).toBe(false)
    expect(dependencies.users.updateUser).not.toHaveBeenCalled()
    expect(dependencies.users.deleteUser).not.toHaveBeenCalled()
  })
  it('本人资料保存推进独立基线，并刷新会话显示名称', async () => {
    const store = useAdminUsersStore()
    const profile = {username: 'operator', displayName: 'Operator', email: null, phone: null,
      department: null, position: null, version: 1, isRoot: false, dictionaryCatalog: profileCatalog}
    dependencies.users.getPersonalProfile.mockResolvedValue(profile)
    await store.loadPersonal()
    store.personal.form.displayName = 'Renamed'
    dependencies.users.updatePersonalProfile.mockResolvedValue({...profile, displayName: 'Renamed', version: 2})
    await store.savePersonal()
    expect(store.personalDirty).toBe(false)
    expect(store.personal.data?.version).toBe(2)
    expect(dependencies.refreshSession).toHaveBeenCalledOnce()
    expect(store.personal.feedback?.message).toBe('个人资料已保存。')
  })

  it('离开本人资料后保存迟到不能恢复草稿或刷新身份', async () => {
    const store = useAdminUsersStore()
    const profile = {username: 'operator', displayName: 'Operator', email: null, phone: null,
      department: null, position: null, version: 1, isRoot: false, dictionaryCatalog: profileCatalog}
    dependencies.users.getPersonalProfile.mockResolvedValue(profile)
    await store.loadPersonal()
    store.personal.form.displayName = 'Renamed'
    const response = deferred<typeof profile>()
    dependencies.users.updatePersonalProfile.mockReturnValueOnce(response.promise)
    const pending = store.savePersonal()
    store.leavePersonal(); response.resolve(profile); await pending
    expect(store.personal.data).toBeNull()
    expect(store.personal.form.displayName).toBe('')
    expect(dependencies.refreshSession).not.toHaveBeenCalled()
  })

  it('本人资料保存后身份刷新失败保留已保存基线和持续警告', async () => {
    const store = useAdminUsersStore()
    const profile = {username: 'operator', displayName: 'Operator', email: null, phone: null,
      department: null, position: null, version: 1, isRoot: false, dictionaryCatalog: profileCatalog}
    dependencies.users.getPersonalProfile.mockResolvedValue(profile)
    await store.loadPersonal(); store.personal.form.displayName = 'Renamed'
    dependencies.users.updatePersonalProfile.mockResolvedValue({...profile, displayName: 'Renamed', version: 2})
    dependencies.refreshSession.mockRejectedValueOnce(new Error('offline'))
    await store.savePersonal()
    expect(store.personalDirty).toBe(false)
    expect(store.personal.warning).toContain('资料已保存')
    expect(store.personal.feedback).toBeNull()
  })
  it('加载列表与目录，并在离开后标记需要重新进入检查', async () => {
    const store = useAdminUsersStore()
    await store.enterList({ page: 1, pageSize: 10, status: 'enabled' })

    expect(dependencies.users.listUsers).toHaveBeenCalledOnce()
    expect(store.list.data?.items[0]?.id).toBe('20')
    expect(store.profileCatalog.departments.options[0]?.code).toBe('maintenance')
    expect(store.list.stale).toBe(false)

    store.leaveList()
    expect(store.list.stale).toBe(true)
    await store.enterList({ page: 1, pageSize: 10, status: 'enabled' })
    expect(dependencies.users.listUsers).toHaveBeenCalledTimes(2)
  })

  it('列表请求按发起顺序失效旧响应', async () => {
    const store = useAdminUsersStore()
    const first = deferred<ReturnType<typeof listPage>>()
    const second = deferred<ReturnType<typeof listPage>>()
    dependencies.users.listUsers
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    const firstLoad = store.loadList({ search: 'old' })
    const secondLoad = store.loadList({ search: 'new' }, { force: true })
    second.resolve(listPage([{ ...user(), id: '22', username: 'new' }]))
    await secondLoad
    expect(store.list.data?.items[0]?.username).toBe('new')

    first.resolve(listPage([{ ...user(), id: '21', username: 'old' }]))
    await firstLoad
    expect(store.list.data?.items[0]?.username).toBe('new')
  })

  it('创建草稿归 store，密码只作为动作参数且不进入可序列化状态', async () => {
    const store = useAdminUsersStore()
    const secret = 'Secret 827346!'
    dependencies.users.createUser.mockResolvedValue(user())
    Object.assign(store.create.form, {
      username: 'new_user',
      displayName: 'New User',
      email: 'new@example.test',
      phone: ' +86 010 12345678 ',
      department: 'maintenance',
      position: '',
      remark: '内部用途'
    })

    await store.createAccount(secret)

    expect(dependencies.users.createUser).toHaveBeenCalledWith({
      username: 'new_user',
      displayName: 'New User',
      email: 'new@example.test',
      phone: '+86 010 12345678',
      department: 'maintenance',
      position: null,
      remark: '内部用途',
      password: secret
    })
    expect(store.create.createdAccount?.id).toBe('20')
    expect(store.create.form.username).toBe('')
    expect(JSON.stringify(store.$state)).not.toContain(secret)
    expect(store.$state).not.toHaveProperty('password')
  })

  it('创建失败保留非敏感草稿并只暴露可控错误', async () => {
    const store = useAdminUsersStore()
    Object.assign(store.create.form, {
      username: 'existing',
      displayName: 'Existing'
    })
    dependencies.users.createUser.mockRejectedValue(new Error('用户名已存在'))

    await store.createAccount('Secret 827346!')

    expect(store.create.form.username).toBe('existing')
    expect(store.create.error).toBe('用户名已存在')
    expect(store.create.createdAccount).toBeNull()
  })

  it('详情草稿只初始化一次，分区保存互不覆盖', async () => {
    const store = useAdminUsersStore()
    await store.enterEditor('20')
    expect(store.editor.user?.id).toBe('20')
    expect(store.editor.form.displayName).toBe('Target')
    expect(store.profileDirty).toBe(false)
    expect(store.rolesDirty).toBe(false)

    store.editor.form.displayName = 'Profile draft'
    store.editor.selected = ['10', '11']
    dependencies.users.updateSection.mockResolvedValueOnce(user({
      displayName: 'Profile draft',
      version: 2
    }))
    await store.saveSection('profile')
    expect(store.profileDirty).toBe(false)
    expect(store.rolesDirty).toBe(true)
    expect(store.editor.selected).toEqual(['10', '11'])

    store.editor.form.email = 'draft@example.test'
    dependencies.users.updateSection.mockResolvedValueOnce(user({
      displayName: 'Profile draft',
      version: 3
    }))
    await store.saveSection('roles')
    expect(store.rolesDirty).toBe(false)
    expect(store.profileDirty).toBe(true)
    expect(store.editor.form.email).toBe('draft@example.test')
    expect(dependencies.users.updateSection.mock.calls[1]?.[2]).toEqual({
      version: 2,
      roleIds: ['10', '11']
    })
  })

  it('切换实体时旧详情响应不能覆盖当前实体', async () => {
    const store = useAdminUsersStore()
    const oldEntity = deferred<UserDetail>()
    const currentEntity = deferred<UserDetail>()
    dependencies.users.getUser
      .mockReturnValueOnce(oldEntity.promise)
      .mockReturnValueOnce(currentEntity.promise)

    const oldLoad = store.loadEditor('20')
    const currentLoad = store.loadEditor('21', { force: true })
    currentEntity.resolve(user({ id: '21', username: 'current' }))
    await currentLoad
    expect(store.editor.user?.username).toBe('current')

    oldEntity.resolve(user({ id: '20', username: 'stale' }))
    await oldLoad
    expect(store.editor.id).toBe('21')
    expect(store.editor.user?.username).toBe('current')
  })

  it('保存期间切换实体后，旧保存响应不能污染新编辑器', async () => {
    const store = useAdminUsersStore()
    await store.enterEditor('20')
    store.editor.form.displayName = 'Old draft'
    const saveResponse = deferred<UserDetail>()
    dependencies.users.updateSection.mockReturnValueOnce(saveResponse.promise)

    const save = store.saveSection('profile')
    dependencies.users.getUser.mockResolvedValueOnce(user({
      id: '21',
      username: 'current',
      displayName: 'Current'
    }))
    await store.enterEditor('21', {force: true})

    saveResponse.resolve(user({
      id: '20',
      username: 'old',
      displayName: 'Old saved value',
      version: 2
    }))
    await save

    expect(dependencies.users.updateSection).toHaveBeenCalledWith(
      '20',
      'profile',
      expect.objectContaining({displayName: 'Old draft'}),
    )
    expect(store.editor.id).toBe('21')
    expect(store.editor.user?.username).toBe('current')
    expect(store.editor.form.displayName).toBe('Current')
    expect(store.editor.feedback).toBeNull()

    store.leaveEditor()
    const lateSave = deferred<UserDetail>()
    dependencies.users.updateSection.mockReturnValueOnce(lateSave.promise)
    dependencies.users.getUser.mockResolvedValueOnce(user({id: '22', username: 'next'}))
    await store.enterEditor('22')
    store.editor.form.remark = 'late'
    const pending = store.saveSection('profile')
    store.leaveEditor()
    lateSave.resolve(user({id: '22', remark: 'late response', version: 2}))
    await pending

    expect(store.editor.id).toBe('')
    expect(store.editor.user).toBeNull()
    expect(store.editor.form.remark).toBe('')
  })

  it('身份变化释放旧列表 Promise，并允许新身份立即发起请求', async () => {
    const store = useAdminUsersStore()
    const oldResponse = deferred<ReturnType<typeof listPage>>()
    const currentResponse = deferred<ReturnType<typeof listPage>>()
    dependencies.users.listUsers
      .mockReturnValueOnce(oldResponse.promise)
      .mockReturnValueOnce(currentResponse.promise)

    const oldLoad = store.loadList({search: 'old identity'})
    useAdminSessionStore().resetIdentity()
    await nextTick()
    const currentLoad = store.enterList({search: 'new identity'})
    expect(dependencies.users.listUsers).toHaveBeenCalledTimes(2)

    currentResponse.resolve(listPage([{...user(), id: '31', username: 'new_identity'}]))
    await currentLoad
    oldResponse.resolve(listPage([{...user(), id: '30', username: 'old_identity'}]))
    await oldLoad

    expect(store.list.data?.items[0]?.username).toBe('new_identity')
  })

  it('会话刷新为未登录会清空业务状态，旧响应不能穿透到下一账号', async () => {
    const store = useAdminUsersStore(), auth = useAdminSessionStore()
    await store.enterList({search: 'initial'})
    const oldResponse = deferred<ReturnType<typeof listPage>>()
    const currentResponse = deferred<ReturnType<typeof listPage>>()
    dependencies.users.listUsers
      .mockReturnValueOnce(oldResponse.promise)
      .mockReturnValueOnce(currentResponse.promise)

    const oldLoad = store.loadList({search: 'old identity'}, {force: true})
    auth.acceptSession({
      authenticated: false,
      mustChangePassword: false,
      user: null,
      csrfToken: '',
    }, auth.generation)
    await nextTick()
    expect(store.list.data).toBeNull()

    auth.acceptSession({
      authenticated: true,
      mustChangePassword: false,
      user: {
        id: '3',
        username: 'new_account',
        displayName: 'New Account',
        isRoot: false,
      },
      csrfToken: 'csrf_3',
    }, auth.generation)
    const currentLoad = store.enterList({search: 'new identity'})
    currentResponse.resolve(listPage([{...user(), id: '33', username: 'new_account'}]))
    await currentLoad
    oldResponse.resolve(listPage([{...user(), id: '22', username: 'old_account'}]))
    await oldLoad

    expect(store.list.data?.items[0]?.username).toBe('new_account')
  })

  it('目录请求从失败恢复后清除旧错误', async () => {
    const store = useAdminUsersStore()
    dependencies.users.getProfileCatalog.mockRejectedValueOnce(new Error('目录离线'))
    await store.enterList({})
    expect(store.profileCatalogError).toBe('目录离线')

    await store.refreshList()

    expect(store.profileCatalogError).toBe('')
    expect(store.profileCatalog.departments.options[0]?.code).toBe('maintenance')
  })

  it('离开列表会失效在途请求，迟到响应不能撤销重新加载标记', async () => {
    const store = useAdminUsersStore()
    const lateResponse = deferred<ReturnType<typeof listPage>>()
    dependencies.users.listUsers.mockReturnValueOnce(lateResponse.promise)
    const load = store.loadList({})
    store.leaveList()

    lateResponse.resolve(listPage())
    await load
    expect(store.list.stale).toBe(true)

    dependencies.users.listUsers.mockResolvedValueOnce(listPage())
    await store.enterList({})
    expect(dependencies.users.listUsers).toHaveBeenCalledTimes(2)
    expect(store.list.stale).toBe(false)
  })

  it('账号身份版本变化时清空列表、目录、创建和编辑业务状态', async () => {
    const store = useAdminUsersStore()
    await store.enterList({})
    await store.enterEditor('20')
    store.editor.form.displayName = 'Unsaved'

    useAdminSessionStore().resetIdentity()
    await nextTick()

    expect(store.list.data).toBeNull()
    expect(store.editor.user).toBeNull()
    expect(store.editor.id).toBe('')
    expect(store.editor.form.displayName).toBe('')
    expect(store.profileCatalog.departments.options).toEqual([])
  })

  it('启停和删除由 store 调用 API，执行期间阻止重复写入', async () => {
    const store = useAdminUsersStore()
    await store.enterList({})
    const row = store.list.data!.items[0]!
    const update = deferred<UserListRecord>()
    dependencies.users.updateUser.mockReturnValueOnce(update.promise)

    const first = store.toggleEnabled(row)
    await store.toggleEnabled(row)
    expect(dependencies.users.updateUser).toHaveBeenCalledOnce()
    expect(dependencies.users.updateUser).toHaveBeenCalledWith('20', {
      version: 1,
      enabled: false
    })

    update.resolve({ ...row, enabled: false, version: 2 })
    await first
    expect(store.list.feedback?.message).toBe('账号已禁用。')

    dependencies.users.deleteUser.mockResolvedValue(undefined)
    await store.remove(row)
    expect(dependencies.users.deleteUser).toHaveBeenCalledWith('20', 2)
  })

  it('列表动作清空末页后返回上一页提示，由页面执行导航', async () => {
    const store = useAdminUsersStore()
    await store.enterList({page: 2, pageSize: 20})
    const row = store.list.data!.items[0]!
    dependencies.users.updateUser.mockResolvedValue({...row, enabled: false, version: 2})
    dependencies.users.listUsers.mockResolvedValueOnce({
      items: [],
      total: 20,
      page: 2,
      pageSize: 20
    })

    const outcome = await store.toggleEnabled(row)

    expect(outcome).toEqual({fallbackPage: 1})
    expect(store.list.feedback?.message).toBe('账号已禁用。')
  })

  it('启停写入后刷新挂起期间切换身份，不向新身份写入反馈或回退结果', async () => {
    const store = useAdminUsersStore()
    await store.enterList({page: 2, pageSize: 20})
    const row = store.list.data!.items[0]!
    dependencies.users.updateUser.mockResolvedValue({...row, enabled: false, version: 2})
    const refreshStarted = deferred<void>()
    const refreshResponse = deferred<ReturnType<typeof listPage>>()
    dependencies.users.listUsers.mockImplementationOnce(() => {
      refreshStarted.resolve(undefined)
      return refreshResponse.promise
    })

    const action = store.toggleEnabled(row)
    await refreshStarted.promise
    useAdminSessionStore().resetIdentity()
    await nextTick()
    refreshResponse.resolve({
      items: [],
      total: 20,
      page: 2,
      pageSize: 20
    })

    expect(await action).toEqual({})
    expect(store.list.feedback).toBeNull()
    expect(store.list.warning).toBe('')
    expect(store.list.data).toBeNull()
  })

  it('删除写入后刷新挂起期间切换身份，不向新身份写入反馈或回退结果', async () => {
    const store = useAdminUsersStore()
    await store.enterList({page: 2, pageSize: 20})
    const row = store.list.data!.items[0]!
    dependencies.users.deleteUser.mockResolvedValue(undefined)
    const refreshStarted = deferred<void>()
    const refreshResponse = deferred<ReturnType<typeof listPage>>()
    dependencies.users.listUsers.mockImplementationOnce(() => {
      refreshStarted.resolve(undefined)
      return refreshResponse.promise
    })

    const action = store.remove(row)
    await refreshStarted.promise
    useAdminSessionStore().resetIdentity()
    await nextTick()
    refreshResponse.resolve({
      items: [],
      total: 20,
      page: 2,
      pageSize: 20
    })

    expect(await action).toEqual({})
    expect(store.list.feedback).toBeNull()
    expect(store.list.warning).toBe('')
    expect(store.list.data).toBeNull()
  })
})
