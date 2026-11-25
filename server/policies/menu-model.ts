// 校验和排序最小菜单树结构，不依赖响应 DTO 或数据库。
import {menuPageCatalog, MAX_MENU_DEPTH} from '../config/menus'
import {permissionCatalog} from '../config/permissions'
import {ApiError} from '../core/errors'
// 树策略只依赖节点结构，不依赖数据库记录或 API 响应。
export interface MenuTreeNode {
    id: bigint;
    parentId: bigint | null;
    pageKey: string | null;
    sortOrder: number
}

export const page = (key: string | null) => menuPageCatalog.find(item => item.key === key && item.available && permissionCatalog.some(p => p.code === item.permission && p.available))

export function validateTree(rows: readonly MenuTreeNode[]) {
    const map = new Map(rows.map(row => [row.id, row]))
    for (const row of rows) {
        let current: MenuTreeNode | undefined = row
        const seen = new Set<bigint>()
        while (current) {
            if (seen.has(current.id) || seen.size >= MAX_MENU_DEPTH) throw new ApiError('INVALID_INPUT')
            seen.add(current.id)
            if (current.parentId === null) break
            const parent = map.get(current.parentId)
            if (!parent || parent.pageKey !== null && parent.pageKey !== 'website_page') throw new ApiError('INVALID_INPUT')
            current = parent
        }
    }
}

export function ordered<T extends MenuTreeNode>(rows: readonly T[]): T[] {
    const result: T[] = []
    const visit = (parent: bigint | null) => {
        for (const row of rows.filter(row => row.parentId === parent).sort((a, b) => a.sortOrder - b.sortOrder || (a.id < b.id ? -1 : 1))) {
            result.push(row);
            visit(row.id)
        }
    }
    visit(null)
    return result
}

