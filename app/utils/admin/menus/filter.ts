// Filtering keeps ancestors visible; unfiltered trees respect collapsed branches.
export function filterMenuTree<T extends {id: string; parentId: string | null; name: string; visible: boolean}>(
    rows: T[], search: string, visibility: string, collapsed: readonly string[],
    searchText: (row: T) => string = row => row.name,
): T[] {
    const keyword = search.trim().toLowerCase(), included = new Set<string>()
    const byId = new Map(rows.map(row => [row.id, row]))
    for (const row of rows) {
        if ((keyword && !searchText(row).toLowerCase().includes(keyword)) || (visibility && row.visible !== (visibility === 'visible'))) continue
        let current: T | undefined = row
        const seen = new Set<string>()
        while (current && !seen.has(current.id)) {
            seen.add(current.id)
            included.add(current.id)
            current = current.parentId ? byId.get(current.parentId) : undefined
        }
    }
    return rows.filter(row => {
        if (!included.has(row.id)) return false
        if (keyword || visibility) return true
        let parent = row.parentId
        const seen = new Set<string>()
        while (parent && !seen.has(parent)) {
            if (collapsed.includes(parent)) return false
            seen.add(parent)
            parent = byId.get(parent)?.parentId ?? null
        }
        return true
    })
}
