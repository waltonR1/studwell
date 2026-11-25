// 回归样本映射，不使用本站安装目录。
import rows from './reference/renderers.json'
export const fixtureRendererPaths=(scope:'public'|'preview')=>Object.fromEntries(rows.filter(row=>row.scope===scope).map(row=>[row.key,row.componentPath]))
