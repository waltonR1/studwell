// Stable module identities and existing maintenance permissions.
export const siteModuleNames = ['news', 'careers', 'inquiries'] as const
export type SiteModuleName = typeof siteModuleNames[number]
export const moduleManagementPath = '/admin/site-modules'
export const siteModuleCatalog = {
 news: {name:'新闻',path:'/admin/news/articles',readPermission:'content.news.read',updatePermission:'content.modules.update'},
 careers: {name:'招聘',path:'/admin/careers/positions',readPermission:'content.careers.read',updatePermission:'content.modules.update'},
 inquiries: {name:'客户咨询',path:'/admin/inquiries',readPermission:'content.inquiries.read',updatePermission:'content.modules.update'},
} as const satisfies Record<SiteModuleName,{name:string;path:string;readPermission:string;updatePermission:string}>
