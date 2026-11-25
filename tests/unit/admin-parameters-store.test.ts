import {beforeEach, describe, expect, it, vi} from 'vitest'
import {createPinia, setActivePinia} from 'pinia'
import {nextTick} from 'vue'
import type {ParameterRecord, ParameterValue} from '../../shared/types/admin/parameters'

const dependencies = vi.hoisted(() => ({
    api: {

        message: vi.fn((error: unknown) => error instanceof Error ? error.message : '请求失败'),
        operationMessage: vi.fn((error: unknown) => error instanceof Error ? error.message : '操作失败'),
    },
    parameters: {
        listParameters: vi.fn(),
        updateParameterBatch: vi.fn(),
    },
    refreshSession: vi.fn(async () => ({
        authenticated: true,
        mustChangePassword: false,
        user: null,
        csrfToken: '',
    })),
}))

vi.mock('~/stores/admin/request', () => ({
    useAdminRequestStore: () => ({...dependencies.api, refreshSession: dependencies.refreshSession}),
}))
vi.mock('~/api/admin/parameters', () => ({
    createParametersApi: () => dependencies.parameters,
}))
import {useAdminParametersStore} from '../../app/stores/admin/parameters'
import {useAdminSessionStore} from '../../app/stores/admin/session'

const parameter = (
    id: string,
    key: string,
    value: ParameterValue,
    overrides: Partial<ParameterRecord> = {},
): ParameterRecord => ({
    id,
    key,
    name: key,
    description: '',
    type: typeof value === 'boolean' ? 'boolean' : 'number',
    defaultValue: value,
    allowedValues: [],
    min: 0,
    max: 100,
    editable: true,
    group: 'password',
    unit: '',
    effect: '立即生效',
    consumers: '认证',
    security: true,
    value,
    override: value,
    invalidOverride: false,
    version: 1,
    createdBy: '1',
    updatedBy: '1',
    createdAt: '2026-10-23T00:00:00Z',
    updatedAt: '2026-10-23T00:00:00Z',
    ...overrides,
})

const minimum = parameter('1', 'security.password.minLength', 6)
const maximum = parameter('2', 'security.password.maxLength', 128)

beforeEach(() => {
    setActivePinia(createPinia())
    const auth = useAdminSessionStore()
    auth.acceptSession({
        authenticated: true,
        mustChangePassword: false,
        user: {
            id: '1',
            username: 'root',
            displayName: 'Root',
            isRoot: true,
        },
        csrfToken: 'csrf',
    }, auth.generation)
    auth.acceptPermissions({isRoot: true, permissions: [], version: 'p1'}, auth.generation)
    dependencies.parameters.listParameters.mockReset()
    dependencies.parameters.updateParameterBatch.mockReset()
    dependencies.refreshSession.mockClear()
    dependencies.parameters.listParameters.mockResolvedValue([minimum, maximum])
})

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason: unknown) => void
    const promise = new Promise<T>((done, fail) => {
        resolve = done
        reject = fail
    })
    return {promise, resolve, reject}
}

describe('参数业务 Pinia store', () => {
    it('加载参数并建立本地查询分页状态', async () => {
        const store = useAdminParametersStore()
        await store.load(false, 20)

        expect(store.rows).toHaveLength(2)
        expect(store.rows[0]?.key).toBe('security.password.minLength')
        store.search = 'maxLength'
        store.applySearch()
        expect(store.filteredRows.map(row => row.id)).toEqual(['2'])
    })

    it('刷新保留未保存参数组，其他组采用服务端新值', async () => {
        const store = useAdminParametersStore()
        await store.load()
        store.draft['1'] = '10'
        const changedLimit = parameter('1', 'security.password.minLength', 8, {version: 2})
        const changedOther = parameter('3', 'security.session.idleSeconds', 60, {
            group: 'session',
            version: 2,
        })
        dependencies.parameters.listParameters.mockResolvedValueOnce([changedLimit, maximum, changedOther])

        await store.refresh()

        expect(store.draft['1']).toBe('10')
        expect(store.originals['1']?.value).toBe(6)
        expect(store.originals['3']?.value).toBe(60)
    })

    it('确认放弃后的强制重载清除旧草稿，但普通后台刷新仍保留草稿', async () => {
        const store = useAdminParametersStore()
        await store.load()
        store.edit(minimum)
        store.draft['1'] = '10'
        await store.refresh()
        expect(store.draft['1']).toBe('10')

        await store.discardAndReload()
        expect(store.open).toBe(false)
        expect(store.draft['1']).toBe(6)
        expect(store.changed(minimum)).toBe(false)
    })

    it('密码组关联非法时不提交批量保存', async () => {
        const store = useAdminParametersStore()
        await store.load()
        store.edit(minimum)
        store.draft['1'] = '128'
        store.draft['2'] = '6'

        const result = await store.save('password')

        expect(result.submitted).toBe(false)
        expect(store.submitError).toBeTruthy()
        expect(dependencies.parameters.updateParameterBatch).not.toHaveBeenCalled()
    })

    it('批量保存推进基线，密码策略保存后刷新会话', async () => {
        const store = useAdminParametersStore()
        await store.load()
        store.edit(minimum)
        store.draft['1'] = '10'
        const saved = {...minimum, value: 10, override: 10, version: 2}
        dependencies.parameters.updateParameterBatch.mockResolvedValue([saved])
        dependencies.parameters.listParameters.mockResolvedValueOnce([saved, maximum])

        const result = await store.save('password')

        expect(result).toMatchObject({submitted: true, succeeded: true})
        expect(dependencies.parameters.updateParameterBatch).toHaveBeenCalledWith({
            items: [{id: '1', version: 1, value: 10}],
        })
        expect(dependencies.refreshSession).toHaveBeenCalledOnce()
        expect(store.originals['1']?.value).toBe(10)
        expect(store.feedback?.message).toBe('参数已保存。')
    })

    it('身份代次变化清空参数、草稿和筛选状态', async () => {
        const store = useAdminParametersStore()
        await store.load()
        store.edit(minimum)
        store.draft['1'] = '10'
        store.search = 'password'
        useAdminSessionStore().resetIdentity()
        await nextTick()

        expect(store.rows).toEqual([])
        expect(store.open).toBe(false)
        expect(store.search).toBe('')
    })

    it('保存后的状态刷新期间切换身份，不向新身份写成功或失败提示', async () => {
        const store = useAdminParametersStore()
        await store.load()
        store.edit(minimum)
        store.draft['1'] = '10'
        dependencies.parameters.updateParameterBatch.mockResolvedValue([
            {...minimum, value: 10, override: 10, version: 2},
        ])
        const refreshStarted = deferred<void>()
        const refreshResponse = deferred<ParameterRecord[]>()
        dependencies.parameters.listParameters.mockImplementationOnce(() => {
            refreshStarted.resolve(undefined)
            return refreshResponse.promise
        })

        const pending = store.save('password')
        await refreshStarted.promise
        useAdminSessionStore().resetIdentity()
        await nextTick()
        refreshResponse.resolve([{...minimum, value: 10, override: 10, version: 2}, maximum])
        const result = await pending

        expect(result).toMatchObject({submitted: true, succeeded: false})
        expect(store.feedback).toBeNull()
        expect(store.warning).toBe('')
    })
})
