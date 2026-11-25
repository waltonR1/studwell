import {describe, expect, it} from 'vitest'
import {createSiteSettings,createSiteLink,emptySiteText} from '../../shared/utils/admin/site-settings'
import {applyNavigationEdit, type NavigationEdit} from '../../app/utils/admin/site-settings/navigation'

const item = (id: string) => ({...createSiteLink(id,{module:'home',resourceId:'1'}), children: [] as import('../../shared/schemas/admin/site-settings').SiteLink[]})
const edit = (value: ReturnType<typeof createSiteLink>, overrides: Partial<NavigationEdit> = {}): NavigationEdit => ({scope: 'header', index: -1, owner: 0, kind: 'link', parent: '', value, ...overrides})
describe('公共导航层级编辑', () => {
  it('新增时选择上级，并支持一级入口降级和子项提升', () => {
    const {header, footer} = createSiteSettings()
    header.items = [item('parent'), item('other')]
    let next = applyNavigationEdit(header, footer, edit(createSiteLink('child',{module:'home',resourceId:'1'}), {parent: 'parent'}))
    expect(next.header.items[0]!.children[0]!.id).toBe('child')
    next = applyNavigationEdit(next.header, footer, edit(createSiteLink('other',{module:'home',resourceId:'1'}), {index: 1, parent: 'parent'}))
    expect(next.header.items.map(x => x.id)).toEqual(['parent'])
    expect(next.header.items[0]!.children.map(x => x.id)).toEqual(['child', 'other'])
    next = applyNavigationEdit(next.header, footer, edit(createSiteLink('child',{module:'home',resourceId:'1'}), {scope: 'child', index: 0}))
    expect(next.header.items.map(x => x.id)).toEqual(['parent', 'child'])
    expect(header.items.map(x => x.id)).toEqual(['parent', 'other'])
  })
  it('编辑不改变原同级顺序；移动子项到另一上级末尾', () => {
    const {header, footer} = createSiteSettings()
    header.items = [item('one'), item('two')]
    header.items[0]!.children = [createSiteLink('a',{module:'home',resourceId:'1'}), createSiteLink('b',{module:'home',resourceId:'1'})]
    let next = applyNavigationEdit(header, footer, edit(createSiteLink('a',{module:'home',resourceId:'1'}), {scope: 'child', index: 0, parent: 'one'}))
    expect(next.header.items[0]!.children.map(x => x.id)).toEqual(['a', 'b'])
    next = applyNavigationEdit(next.header, footer, edit(createSiteLink('a',{module:'home',resourceId:'1'}), {scope: 'child', index: 0, parent: 'two'}))
    expect(next.header.items[0]!.children.map(x => x.id)).toEqual(['b'])
    expect(next.header.items[1]!.children[0]!.id).toBe('a')
  })
  it('允许挂在任意一级导航下，拒绝自我归属和带子项降级', () => {
    const {header, footer} = createSiteSettings()
    header.items = [item('one'), item('two')]
    header.items[1]!.target = {module:'about',resourceId:'1',type:'page',value:''}
    const before = structuredClone(header)
    expect(() => applyNavigationEdit(header, footer, edit(createSiteLink('one',{module:'home',resourceId:'1'}), {index: 0, parent: 'one'}))).toThrow()
    expect(applyNavigationEdit(header, footer, edit(createSiteLink('child',{module:'home',resourceId:'1'}), {parent: 'two'})).header.items[1]!.children[0]!.id).toBe('child')
    expect(header).toEqual(before)
    header.items[0]!.children.push(createSiteLink('child',{module:'home',resourceId:'1'}))
    expect(() => applyNavigationEdit(header, footer, edit(createSiteLink('one',{module:'home',resourceId:'1'}), {index: 0, parent: 'two'}))).toThrow('请先移走子项')
    const changed = createSiteLink('one',{module:'home',resourceId:'1'}); changed.target.module = 'products'
    expect(applyNavigationEdit(header, footer, edit(changed, {index: 0})).header.items[0]!.children).toHaveLength(1)
  })
  it('页脚新增链接选择分组，编辑可换组；编辑分组保留子项', () => {
    const {header, footer} = createSiteSettings()
    footer.groups = ['one', 'two'].map(id => ({id, title: emptySiteText(), visible: true, items: []}))
    let next = applyNavigationEdit(header, footer, edit(createSiteLink('link',{module:'home',resourceId:'1'}), {scope: 'group', parent: 'one'}))
    expect(next.footer.groups[0]!.items[0]!.id).toBe('link')
    next = applyNavigationEdit(header, next.footer, edit(createSiteLink('link',{module:'home',resourceId:'1'}), {scope: 'footer', index: 0, parent: 'two'}))
    expect(next.footer.groups[0]!.items).toHaveLength(0)
    expect(next.footer.groups[1]!.items[0]!.id).toBe('link')
    const group = createSiteLink('two',{module:'home',resourceId:'1'}); group.label.zh = '新名称'
    next = applyNavigationEdit(header, next.footer, edit(group, {scope: 'group', kind: 'group', index: 1}))
    expect(next.footer.groups[1]!.title.zh).toBe('新名称')
    expect(next.footer.groups[1]!.items).toHaveLength(1)
    expect(() => applyNavigationEdit(header, footer, edit(createSiteLink('link',{module:'home',resourceId:'1'}), {scope: 'footer', parent: ''}))).toThrow('请选择链接所属')
  })
  it('数量超限时拒绝新增而不移除源节点', () => {
    const {header, footer} = createSiteSettings()
    header.items = Array.from({length: 20}, (_, n) => item('item_' + n))
    expect(() => applyNavigationEdit(header, footer, edit(createSiteLink('extra',{module:'home',resourceId:'1'})))).toThrow('数量超出限制')
    expect(header.items).toHaveLength(20)
  })
})
