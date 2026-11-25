import type {AdminRefreshTarget, AdminRefreshRegistry} from '~/types/admin/refresh'
import {computed, inject, onScopeDispose, provide, ref, shallowRef, toValue} from 'vue'
import type {InjectionKey, MaybeRefOrGetter, Ref} from 'vue'

const adminRefreshKey: InjectionKey<AdminRefreshRegistry> = Symbol('admin-refresh')

export function provideAdminRefreshRegistry(): AdminRefreshRegistry {
    const targets = new Set<AdminRefreshTarget>()
    const busySources = shallowRef<Readonly<Ref<boolean>>[]>([])
    const registry: AdminRefreshRegistry = {
        refreshing: ref(false),
        blocked: computed(() => busySources.value.some(source => source.value)),
        registerBusy(source) {
            busySources.value = [...busySources.value, source]
            return () => {
                busySources.value = busySources.value.filter(item => item !== source)
            }
        },
        register(target) {
            targets.add(target)
            return () => targets.delete(target)
        },
        async confirm() {
            for (const target of targets) {
                if (target.confirm && !await target.confirm()) return false
            }
            return true
        },
        async refresh() {
            const results = await Promise.allSettled([...targets].map(target => target.refresh()))
            const failure = results.find(result => result.status === 'rejected')
            if (failure?.status === 'rejected') throw failure.reason
        }
    }
    provide(adminRefreshKey, registry)
    return registry
}

export function useAdminRefresh(refresh: () => Promise<void>, confirm?: () => Promise<boolean>) {
    const registry = inject(adminRefreshKey)
    if (!registry) throw new Error('后台页面刷新需要 admin Layout')
    const unregister = registry.register({refresh, confirm})
    onScopeDispose(unregister)
}

// 只投影业务 store 的提交状态与框架刷新锁，不再维护第二份可写提交状态。
export function useAdminBusy(source: MaybeRefOrGetter<boolean>) {
    const registry = inject(adminRefreshKey)
    const registered = computed(() => toValue(source))
    if (registry) onScopeDispose(registry.registerBusy(registered))
    return computed(() => registered.value || !!registry?.refreshing.value)
}
