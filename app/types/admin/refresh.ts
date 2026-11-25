// 页面刷新注册与提交锁投影的框架契约。
import type {Ref} from 'vue'

export type AdminRefreshTarget = {
    confirm?: () => Promise<boolean>
    refresh: () => Promise<void>
}

export type AdminRefreshRegistry = {
    refreshing: Ref<boolean>
    blocked: Readonly<Ref<boolean>>
    registerBusy: (source: Readonly<Ref<boolean>>) => () => void
    register: (target: AdminRefreshTarget) => () => void
    confirm: () => Promise<boolean>
    refresh: () => Promise<void>
}

