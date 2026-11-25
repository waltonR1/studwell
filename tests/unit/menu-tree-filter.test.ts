import {describe, expect, it} from 'vitest'
import {filterMenuTree} from '../../app/utils/admin/menus/filter'
const rows = [
    {id: 'root', parentId: null, name: '公司', visible: true},
    {id: 'child', parentId: 'root', name: '业务', visible: true},
    {id: 'leaf', parentId: 'child', name: '投资', visible: false},
    {id: 'other', parentId: null, name: '联系', visible: true},
]
describe('菜单和公共导航共用树筛选', () => {
    it('折叠父级时隐藏整个分支，其他根节点仍可见', () => {
        expect(filterMenuTree(rows, '', '', ['root']).map(row => row.id)).toEqual(['root', 'other'])
    })
    it('查找折叠分支中的子项时显示完整祖先链', () => {
        expect(filterMenuTree(rows, '投资', '', ['root']).map(row => row.id)).toEqual(['root', 'child', 'leaf'])
    })
    it('显示状态筛选保留父级上下文，退出筛选恢复折叠状态', () => {
        expect(filterMenuTree(rows, '', 'hidden', ['root']).map(row => row.id)).toEqual(['root', 'child', 'leaf'])
        expect(filterMenuTree(rows, '', '', ['root']).map(row => row.id)).toEqual(['root', 'other'])
    })
})
