// 计算菜单的祖先路径、展示深度与上级隐藏状态；限制回溯深度并避免循环遍历。
export function describeMenu<T extends {
    id: string;
    parentId: string | null;
    name: string;
    visible: boolean
}>(row: T, rows: T[]) {
    const map = new Map(rows.map(item => [item.id, item]))
    const ancestors: T[] = [], seen = new Set([row.id])
    let parent = row.parentId ? map.get(row.parentId) : undefined
    while (parent && !seen.has(parent.id) && ancestors.length < 8) {
        seen.add(parent.id);
        ancestors.unshift(parent)
        parent = parent.parentId ? map.get(parent.parentId) : undefined
    }
    return {
        depth: ancestors.length,
        path: [...ancestors.map(item => item.name), row.name].join(' / '),
        hiddenByParent: ancestors.some(item => !item.visible)
    }
}
