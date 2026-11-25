import {beforeEach, describe, expect, it, vi} from 'vitest'
import {createPinia, setActivePinia} from 'pinia'
import {nextTick} from 'vue'
import type {DictionaryDetail} from '../../shared/types/admin/dictionaries'

const dependencies = vi.hoisted(() => ({
    api: {

        message: vi.fn((error: unknown) => error instanceof Error ? error.message : '请求失败'),
        operationMessage: vi.fn((error: unknown) => error instanceof Error ? error.message : '操作失败'),
    },
    dictionaries: {
        listDictionaries: vi.fn(),
        getDictionary: vi.fn(),
        createDictionary: vi.fn(),
        updateDictionary: vi.fn(),
        createItem: vi.fn(),
        updateItem: vi.fn(),
    },
}))

vi.mock('~/stores/admin/request', () => ({
    useAdminRequestStore: () => dependencies.api,
}))
vi.mock('~/api/admin/dictionaries', () => ({
    createDictionariesApi: () => dependencies.dictionaries,
}))

import {useAdminDictionariesStore} from '../../app/stores/admin/dictionaries'
import {useAdminSessionStore} from '../../app/stores/admin/session'

const detail = (overrides: Partial<DictionaryDetail> = {}): DictionaryDetail => ({
    id: '10',
    code: 'department',
    name: '部门',
    description: '组织部门',
    enabled: true,
    version: 1,
    optionCount: 2,
    enabledOptionCount: 1,
    createdBy: '1',
    updatedBy: '1',
    createdAt: '2026-10-23T00:00:00Z',
    updatedAt: '2026-10-23T00:00:00Z',
    items: [
        {
            id: '20',
            dictionaryId: '10',
            code: 'quality',
            name: '质量部',
            sortOrder: 20,
            enabled: true,
            createdBy: '1',
            updatedBy: '1',
            createdAt: '2026-10-23T00:00:00Z',
            updatedAt: '2026-10-23T00:00:00Z',
        },
        {
            id: '21',
            dictionaryId: '10',
            code: 'retired',
            name: '旧部门',
            sortOrder: 10,
            enabled: false,
            createdBy: '1',
            updatedBy: '1',
            createdAt: '2026-10-23T00:00:00Z',
            updatedAt: '2026-10-23T00:00:00Z',
        },
    ],
    ...overrides,
})

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
    for (const value of Object.values(dependencies.dictionaries))
        value.mockReset()
    dependencies.dictionaries.listDictionaries.mockResolvedValue({
        items: [detail()],
        total: 1,
        page: 1,
        pageSize: 20,
    })
    dependencies.dictionaries.getDictionary.mockResolvedValue(detail())
})

describe('字典业务 Pinia store', () => {
    it('加载类型列表并打开详情，初始化类型与共享版本', async () => {
        const store = useAdminDictionariesStore()
        await store.enterList({})
        expect(store.list.data?.items[0]?.code).toBe('department')

        await store.openDictionary('10')
        expect(store.editor.detail?.version).toBe(1)
        expect(store.editor.typeForm.name).toBe('部门')
        expect(store.metadataDirty).toBe(false)
    })

    it('保存类型推进共享版本并保留独立选项数据', async () => {
        const store = useAdminDictionariesStore()
        await store.openDictionary('10')
        store.editor.typeForm.name = '组织部门'
        dependencies.dictionaries.updateDictionary.mockResolvedValue(detail({
            name: '组织部门',
            version: 2,
        }))

        await store.saveType()

        expect(dependencies.dictionaries.updateDictionary).toHaveBeenCalledWith('10', {
            name: '组织部门',
            description: '组织部门',
            enabled: true,
            version: 1,
        })
        expect(store.editor.detail?.version).toBe(2)
        expect(store.metadataDirty).toBe(false)
        expect(store.list.stale).toBe(true)
    })

    it('选项筛选分页和保存都使用当前共享详情版本', async () => {
        const store = useAdminDictionariesStore()
        await store.openDictionary('10')
        store.editor.itemSearch = 'quality'
        expect(store.filteredItems.map(item => item.id)).toEqual(['20'])

        store.startItem(store.editor.detail!.items[0]!)
        store.editor.itemForm.name = '质量管理部'
        dependencies.dictionaries.updateItem.mockResolvedValue(detail({
            version: 2,
            items: [{
                ...store.editor.detail!.items[0]!,
                name: '质量管理部',
            }, store.editor.detail!.items[1]!],
        }))

        const result = await store.saveItem()

        expect(result.succeeded).toBe(true)
        expect(dependencies.dictionaries.updateItem).toHaveBeenCalledWith('20', expect.objectContaining({
            dictionaryId: '10',
            version: 1,
        }))
        expect(store.editor.detail?.version).toBe(2)
        expect(store.editor.itemEditorOpen).toBe(false)
    })

    it('切换字典或关闭编辑器会释放类型和选项草稿', async () => {
        const store = useAdminDictionariesStore()
        await store.openDictionary('10')
        store.editor.typeForm.name = '未保存'
        store.startItem(null)
        store.editor.itemForm.name = '新选项'

        await store.openDictionary(null)

        expect(store.editor.detail).toBeNull()
        expect(store.editor.typeForm.name).toBe('')
        expect(store.editor.itemEditorOpen).toBe(false)
        expect(store.editor.itemForm.name).toBe('')
    })

    it('已有字典首次加载失败后，刷新仍按原 ID 重试详情而不是切为新增', async () => {
        const store = useAdminDictionariesStore()
        dependencies.dictionaries.getDictionary.mockRejectedValueOnce(new Error('暂时离线'))
        await store.openDictionary('10')
        expect(store.editor.loadError).toBe('暂时离线')
        expect(store.editor.detail).toBeNull()

        dependencies.dictionaries.getDictionary.mockResolvedValueOnce(detail())
        await store.refreshEditor()

        expect(dependencies.dictionaries.getDictionary).toHaveBeenLastCalledWith('10')
        expect(store.editor.dictionaryId).toBe('10')
        expect(store.editor.detail?.id).toBe('10')
        expect(store.createMode).toBe(false)
    })

    it('身份代次变化清空列表、详情和两类草稿', async () => {
        const store = useAdminDictionariesStore()
        await store.enterList({})
        await store.openDictionary('10')
        store.startItem(null)
        store.editor.itemForm.name = '新选项'
        useAdminSessionStore().resetIdentity()
        await nextTick()

        expect(store.list.data).toBeNull()
        expect(store.editor.detail).toBeNull()
        expect(store.editor.open).toBe(false)
        expect(store.editor.itemForm.name).toBe('')
    })
})
