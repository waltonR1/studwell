import {beforeEach, describe, expect, it, vi} from 'vitest'
import {createPinia, setActivePinia} from 'pinia'
import {computed, effectScope, nextTick, reactive, ref} from 'vue'
import type {AdminSessionState} from '../../shared/types/admin/auth'

const dependencies = vi.hoisted(() => ({
    getNavigation: vi.fn(),
    write: vi.fn(async () => {}),
    api: {
        refreshPermissions: vi.fn(async () => {}),
        operationMessage: vi.fn((error: unknown) =>
            error instanceof Error ? error.message : '请求失败'),
    },
    notification: null as unknown,
    show: vi.fn(),
    refreshing: null as unknown,
    blocked: null as unknown,
    preferences: null as unknown,
}))

vi.mock('~/stores/admin/request', () => ({
    useAdminRequestStore: () => ({...dependencies.api, write: dependencies.write}),
}))
vi.mock('~/api/admin/menus', () => ({
    createMenusApi: () => ({getNavigation: dependencies.getNavigation}),
}))
vi.mock('~/composables/admin/interaction/useAdminToast', () => ({
    useAdminToast: () => ({
        notification: dependencies.notification,
        show: dependencies.show,
    }),
}))
vi.mock('~/composables/admin/navigation/useAdminRefresh', () => ({
    provideAdminRefreshRegistry: () => ({
        refreshing: dependencies.refreshing,
        blocked: dependencies.blocked,
        confirm: vi.fn(async () => true),
        refresh: vi.fn(async () => {}),
    }),
}))
vi.mock('~/composables/admin/navigation/useAdminNavigationPreferences', () => ({
    useAdminNavigationPreferences: () => dependencies.preferences,
}))

import {useAdminFrame} from '../../app/composables/admin/navigation/useAdminFrame'
import {useAdminSessionStore} from '../../app/stores/admin/session'

const session = (): AdminSessionState => ({
    authenticated: true,
    mustChangePassword: false,
    user: {
        id: '2',
        username: 'operator',
        displayName: 'Operator',
        isRoot: false,
    },
    csrfToken: 'csrf',
})

beforeEach(() => {
    setActivePinia(createPinia())
    const auth = useAdminSessionStore()
    auth.acceptSession(session(), auth.generation)
    dependencies.getNavigation.mockReset()
    dependencies.getNavigation.mockResolvedValue({
        version: 'v1',
        items: [{
            id: 'users',
            parentId: null,
            code: 'users',
            name: '账号管理',
            path: '/admin/users',
            iconKey: 'users',
        }],
    })
    dependencies.write.mockClear()
    dependencies.api.refreshPermissions.mockClear()
    dependencies.notification = ref(null)
    dependencies.show.mockClear()
    dependencies.refreshing = ref(false)
    dependencies.blocked = ref(false)
    dependencies.preferences = {
        collapsed: ref(false),
        closed: ref([]),
        busy: ref(false),
        isCompact: ref(false),
        mobileOpen: ref(false),
        userMenuOpen: ref(false),
        refreshStatus: ref(''),
        railCollapsed: computed(() => false),
        navigationExpanded: computed(() => true),
        navigationTooltip: ref(null),
        toggle: vi.fn(),
        toggleNavigation: vi.fn(),
        showNavigationTooltip: vi.fn(),
        hideNavigationTooltip: vi.fn(),
    }
})

describe('后台框架导航生命周期', () => {
    it('同一身份切换管理员路由时使导航缓存失效并重新验证', async () => {
        const route = reactive({
            path: '/admin/users',
            params: {},
            meta: {},
        })
        vi.stubGlobal('useRoute', () => route)
        vi.stubGlobal('useState', (_key: string, initialize: () => unknown) => ref(initialize()))
        vi.stubGlobal('navigateTo', vi.fn(async () => {}))
        const scope = effectScope()
        const frame = await scope.run(() => useAdminFrame({active: true}))!.ready

        expect(frame).toBe(true)
        expect(dependencies.getNavigation).toHaveBeenCalledOnce()

        route.path = '/admin/roles'
        await nextTick()
        await Promise.resolve()
        await nextTick()

        expect(dependencies.getNavigation).toHaveBeenCalledTimes(2)
        scope.stop()
        vi.unstubAllGlobals()
    })
    it('区块详情沿用所属页面的高亮与面包屑入口', async () => {
        dependencies.getNavigation.mockResolvedValue({version:'website',items:[
            {id:'maintenance',parentId:null,code:'page_maintenance',name:'页面维护',iconKey:'globe',path:null},
            {id:'home',parentId:'maintenance',code:'website_home',name:'首页',iconKey:'file-text',path:'/admin/website/website_home'}
        ]})
        const route=reactive({path:'/admin/website/website_home/sections/123',params:{id:'123'},meta:{}})
        vi.stubGlobal('useRoute',()=>route)
        vi.stubGlobal('useState',(_key:string,initialize:()=>unknown)=>ref(initialize()))
        const scope=effectScope(),frame=scope.run(()=>useAdminFrame({active:true}))!
        await frame.ready
        expect(frame.currentPage.value?.id).toBe('home')
        expect(frame.visibleItems.value.map(item=>item.name)).toEqual(['页面维护','首页'])
        expect(frame.visibleCrumbs.value.map(item=>item.name)).toEqual(['页面维护','首页'])
        expect(frame.crumbDestination(frame.currentPage.value!)).toBe('/admin/website/website_home')
        scope.stop();vi.unstubAllGlobals()
    })

})
