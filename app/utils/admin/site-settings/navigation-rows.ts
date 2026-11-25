// 将页头、页脚导航投影为表格行，不修改输入；行保留原列表身份供上层业务动作定位。
import type {SiteSettings,SiteLocale,SiteLink} from '#shared/schemas/admin/site-settings'
export function siteNavigationRows(section:'header'|'footer',header:SiteSettings['header'],footer:SiteSettings['footer'],locale:SiteLocale,targetName:(link:SiteLink)=>string){
  const result: Array<{
    id: string;
    name: string;
    depth: number;
    parentId: string | null;
    scope: 'header' | 'child' | 'footer' | 'group';
    index: number;
    owner: number;
    list: unknown[];
    visible: boolean;
    hiddenByParent: boolean;
    target: string;
    hasChildren: boolean;
  }> = []
  const add = (link: SiteLink, scope: 'header' | 'child' | 'footer', index: number, owner: number, depth: number, parent: string | null, list: unknown[], hiddenByParent = false) => result.push({
    id: (parent ?? 'root') + ':' + link.id,
    name: link.label[locale] || targetName(link),
    depth,
    parentId: parent,
    scope,
    index,
    owner,
    list,
    visible: link.visible,
    hiddenByParent,
    target: targetName(link),
    hasChildren: false,
  })
  if (section === 'header') header.items.forEach((item, index) => {
    add(item, 'header', index, 0, 0, null, header.items, false);
    const root = result[result.length - 1]!;
    root.hasChildren = item.children.length > 0;
    item.children.forEach((child, i) => add(child, 'child', i, index, 1, root.id, item.children, !item.visible))
  })
  else footer.groups.forEach((group, index) => {
    const key = 'group:' + group.id;
    result.push({
      id: key,
      name: group.title[locale] || '链接分组',
      depth: 0,
      parentId: null,
      scope: 'group',
      index,
      owner: 0,
      list: footer.groups,
      visible: group.visible,
      hiddenByParent: false,
      target: '链接分组',
      hasChildren: group.items.length > 0,
    });
    group.items.forEach((item, i) => add(item, 'footer', i, index, 1, key, group.items, !group.visible))
  })
 return result
}
