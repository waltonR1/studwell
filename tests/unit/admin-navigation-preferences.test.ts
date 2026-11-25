import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const lifecycle = vi.hoisted(() => ({
    mounted: [] as Array<() => void>,
    beforeUnmount: [] as Array<() => void>,
}))

vi.mock('vue', async importOriginal => ({
    ...await importOriginal<typeof import('vue')>(),
    onMounted: (callback: () => void) => lifecycle.mounted.push(callback),
    onBeforeUnmount: (callback: () => void) => lifecycle.beforeUnmount.push(callback),
}))

import {effectScope, nextTick, ref} from 'vue'
import {useAdminNavigationPreferences} from '../../app/composables/admin/navigation/useAdminNavigationPreferences'

let values: Map<string, string>

beforeEach(() => {
    values = new Map()
    lifecycle.mounted = []
    lifecycle.beforeUnmount = []
    vi.stubGlobal('useRoute', () => ({fullPath: '/admin/users'}))
    vi.stubGlobal('localStorage', {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
    })
    vi.stubGlobal('document', {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    })
    vi.stubGlobal('window', {
        matchMedia: () => ({
            matches: false,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }),
    })
})

afterEach(() => vi.unstubAllGlobals())

describe('后台导航外观偏好生命周期', () => {
    it('账号变化时读取该账号自己的折叠与分组偏好，不把旧账号状态写入新键', async () => {
        values.set('studwell-admin-nav-2', JSON.stringify({
            collapsed: true,
            closed: ['users'],
        }))
        values.set('studwell-admin-nav-3', JSON.stringify({
            collapsed: false,
            closed: ['logs_audit'],
        }))
        const owner = ref('2'), scope = effectScope()
        const state = scope.run(() => useAdminNavigationPreferences(
            {active: true},
            owner,
        ))!
        lifecycle.mounted.forEach(callback => callback())
        expect(state.collapsed.value).toBe(true)
        expect(state.closed.value).toEqual(['users'])

        owner.value = '3'
        await nextTick()
        expect(state.collapsed.value).toBe(false)
        expect(state.closed.value).toEqual(['logs_audit'])

        state.toggle('users')
        await nextTick()
        expect(JSON.parse(values.get('studwell-admin-nav-3')!)).toEqual({
            collapsed: false,
            closed: ['logs_audit', 'users'],
        })
        expect(JSON.parse(values.get('studwell-admin-nav-2')!)).toEqual({
            collapsed: true,
            closed: ['users'],
        })
        scope.stop()
    })
})
