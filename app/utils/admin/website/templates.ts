import type {WebsiteTemplateCatalogRecord} from '#shared/types/admin/website'

// 仅格式化服务端目录投影，不读取菜单或从预览样例推断适用范围。
export function templateScope(pages:WebsiteTemplateCatalogRecord['applicablePages']) {
 if(pages===null)return '历史遗留'
 return pages==='all'?'全部页面':pages.map(page=>page.name??`未登记页面（${page.key}）`).join('、')
}
export function sectionItemTitle(value:unknown,index:number) {
 if(value&&typeof value==='object'&&!Array.isArray(value)) {
  const item=value as Record<string,unknown>
  for(const key of ['title','name','headline','period','label','displayValue','number']) {
   if(typeof item[key]==='string'&&item[key])return `${index+1}. ${String(item[key]).slice(0,70)}`
  }
 }
 return `第 ${index+1} 项`
}
