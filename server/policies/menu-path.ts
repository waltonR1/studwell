// 根据菜单页面信息生成访问路径，不读取菜单授权状态。
import type {MenuPage} from '#shared/types/admin/menus'

// 路由形状由代码控制；通配页只替换通过菜单编码校验的单段参数。
export function menuPagePath(page: MenuPage | undefined, code: string): string | null {
    if (!page) return null
    return page.repeatable ? page.path.replace(':code', encodeURIComponent(code)) : page.path
}

