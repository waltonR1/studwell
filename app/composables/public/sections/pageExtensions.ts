// 页面业务扩展注册表：由页面入口传入装配器，在 setup 中执行详情加载、上下文注入及区块跳转解析。
import {newsRoute} from '~/composables/public/sections/news/detailRoute'
import {entryBehavior} from '~/utils/public/sections/common/pageEntryBehavior'
import type {RouteExtension} from '~/utils/public/runtime/routeTemplates'
import type {PageBehavior} from '~/utils/public/runtime/pageBehaviors'
// 业务能力在此注册扩展；平台入口不解释具体业务类型或区块键。
export const detailTemplates = [newsRoute] satisfies readonly RouteExtension[]
export const sectionBehaviors = [entryBehavior] satisfies readonly PageBehavior[]
