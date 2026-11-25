import {siteHeaderSchema, siteFooterSchema, type SiteLink, type SiteSettings} from '#shared/schemas/admin/site-settings'

export interface NavigationEdit {
  scope: 'header' | 'child' | 'footer' | 'group'
  index: number
  owner: number
  kind: 'link' | 'group'
  parent: string
  value: SiteLink
}

// Build and validate a copy before replacing the draft, so invalid moves never remove the source.
export function applyNavigationEdit(header: SiteSettings['header'], footer: SiteSettings['footer'], edit: NavigationEdit) {
  const next = structuredClone({header, footer})
  if (edit.scope === 'header' || edit.scope === 'child') {
    const list = edit.scope === 'header' ? next.header.items : next.header.items[edit.owner]?.children
    if (!list) throw new Error('原导航不存在，请重新打开编辑窗口。')
    const children = edit.scope === 'header' && edit.index >= 0 ? next.header.items[edit.index]?.children ?? [] : []
    if (children.length && edit.parent !== '') throw new Error('请先移走子项，再将一级导航移到其他导航下面。')
    if (edit.index >= 0) list.splice(edit.index, 1)
    if (edit.parent === '') {
      const item = {...edit.value, children}
      next.header.items.splice(edit.scope === 'header' && edit.index >= 0 ? edit.index : next.header.items.length, 0, item)
    } else {
      const parent = next.header.items.find(item => item.id === edit.parent)
      if (!parent) throw new Error('请选择有效的上级导航。')
      parent.children.splice(edit.scope === 'child' && header.items[edit.owner]?.id === edit.parent && edit.index >= 0 ? edit.index : parent.children.length, 0, edit.value)
    }
    if (!siteHeaderSchema.safeParse(next.header).success) throw new Error('导航数量超出限制或存在重复项，请检查后重试。')
  } else {
    if (edit.kind === 'group') {
      const previous = edit.index < 0 ? undefined : next.footer.groups[edit.index]
      const group = {id: edit.value.id, title: edit.value.label, visible: edit.value.visible, items: previous?.items ?? []}
      if (edit.index < 0) next.footer.groups.push(group)
      else next.footer.groups.splice(edit.index, 1, group)
    } else {
      const list = next.footer.groups[edit.owner]?.items
      if (edit.index >= 0) {
        if (!list) throw new Error('原分组不存在，请重新打开编辑窗口。')
        list.splice(edit.index, 1)
      }
      const parent = next.footer.groups.find(group => group.id === edit.parent)
      if (!parent) throw new Error('请选择链接所属的页脚分组。')
      parent.items.splice(footer.groups[edit.owner]?.id === edit.parent && edit.index >= 0 ? edit.index : parent.items.length, 0, edit.value)
    }
    if (!siteFooterSchema.safeParse(next.footer).success) throw new Error('分组或链接数量超出限制，或存在重复项，请检查后重试。')
  }
  return next
}
