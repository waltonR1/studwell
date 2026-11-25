// 根据页面目录和现有绑定生成菜单表单选项；服务端仍负责绑定合法性与权限校验。
import type {MenuPageCatalogItem} from '#shared/types/admin/menus.ts'

// 新增时筛选可绑定页面；编辑时保留当前绑定的显示选项，无匹配项时显示停用说明。
export function menuPageOptions(pages: MenuPageCatalogItem[], menus: Array<{
    pageKey: string | null
}>, current?: string | null) {
    const candidates = current !== undefined
        ? pages.filter(page => page.key === current)
        : pages.filter(page => !page.builtin && page.available && page.grantable && (page.repeatable || !menus.some(item => item.pageKey === page.key)))
    const result = [{label: '目录', value: ''}, ...candidates.map(page => ({label: page.name, value: page.key}))]
    if (current && !candidates.length) result.push({label: `已停用页面（${current}）`, value: current})
    return result
}
