// 系统静态页面目录；数据库仅引用 key，不生成 Nuxt 路由或任意外链。
import type {MenuPage} from '#shared/types/admin/menus.ts'

export const menuPageCatalog: readonly MenuPage[] = [
 {key:'site_modules',name:'模块管理',path:'/admin/site-modules',permission:'content.modules.read',operations:['content.modules.read','content.modules.update'],available:true},
 {key:'career_positions',name:'岗位管理',path:'/admin/careers/positions',permission:'content.careers.read',operations:['content.careers.read','content.careers.update','content.careers.publish'],available:true},
 {key:'customer_inquiries',name:'咨询列表',path:'/admin/inquiries',permission:'content.inquiries.read',operations:['content.inquiries.read','content.inquiries.update','content.inquiries.assign','content.inquiries.mail.send'],available:true},
 {key:'customer_inquiry_settings',name:'咨询类型',path:'/admin/inquiry-settings',permission:'content.inquiries.settings',operations:['content.inquiries.settings'],available:true},
 {key:'customer_inquiry_mail_settings',name:'邮件设置',path:'/admin/inquiry-mail-settings',permission:'content.inquiries.settings',operations:['content.inquiries.settings'],available:true},
 {key:'news_articles',name:'文章管理',path:'/admin/news/articles',permission:'content.news.read',operations:['content.news.read','content.news.update','content.news.delete','content.news.publish','content.news.operations.update'],available:true},
 {key:'news_categories',name:'新闻分类',path:'/admin/news/categories',permission:'content.news.read',operations:['content.news.read','content.news.categories.update'],available:true},
 {key:'site_languages',name:'站点语言',path:'/admin/site-languages',permission:'content.site_languages.read',operations:['content.site_languages.read','content.site_languages.update','content.site_languages.publish'],available:true},
 {key:'website_routes',name:'路由与 SEO',path:'/admin/website-routes',permission:'content.routes.read',operations:['content.routes.read','content.routes.update','content.routes.publish'],available:true},
 {key:'website_templates',name:'区块模板',path:'/admin/website-templates',permission:'content.templates.read',operations:['content.templates.read','content.templates.update'],available:true},
    ...(['header', 'footer'] as const).map(section => ({key: 'site_' + section, name: section === 'header' ? '页头维护' : '页脚维护', path: '/admin/site-' + section, permission: 'content.site_settings.read', operations: ['content.site_settings.read', 'content.site_settings.update', 'content.site_settings.publish'], available: true})),
    {key: 'site_settings', name: '网站标识', path: '/admin/site-settings', permission: 'content.site_settings.read', operations: ['content.site_settings.read', 'content.site_settings.update', 'content.site_settings.publish'], available: true},
    {key:'media',name:'媒体库',path:'/admin/media',permission:'content.media.read',operations:['content.media.read','content.media.create','content.media.update','content.media.delete'],available:true},
    {key: 'environment', name: '系统环境', path: '/admin/environment', permission: 'system.environment.read', operations: ['system.environment.read'], available: true},
    {
        key: 'tasks',
        name: '定时任务',
        path: '/admin/tasks',
        permission: 'system.tasks.read',
        operations: ['system.tasks.read', 'system.tasks.update', 'system.tasks.change_status', 'system.tasks.run', 'system.tasks.stop', 'system.tasks.force_stop'],
        available: true
    },
    {
        key: 'dashboard',
        name: '后台首页',
        path: '/admin',
        permission: 'system.dashboard.read',
        operations: ['system.dashboard.read'],
        available: true,
        builtin: true
    },
    {
        key: 'login_logs',
        name: '登录日志',
        path: '/admin/logs/login',
        permission: 'system.logs.login.read',
        operations: ["system.logs.login.read", "system.logs.login.export", "system.logs.login.sources.read", "system.logs.login.sources.export"],
        available: true
    },
    {
        key: 'audit_logs',
        name: '操作审计',
        path: '/admin/logs/audit',
        permission: 'system.logs.audit.read',
        operations: ["system.logs.audit.read", "system.logs.audit.export", "system.logs.audit.sources.read", "system.logs.audit.sources.export"],
        available: true
    },
    {
        key: 'security_logs',
        name: '安全事件',
        path: '/admin/logs/security',
        permission: 'system.logs.security.read',
        operations: ["system.logs.security.read", "system.logs.security.export", "system.logs.security.sources.read", "system.logs.security.sources.export"],
        available: true
    },
    {
        key: 'dictionaries',
        name: '数据字典',
        path: '/admin/dictionaries',
        permission: 'system.dictionaries.read',
        operations: ["system.dictionaries.read", "system.dictionaries.create", "system.dictionaries.update", "system.dictionaries.items.create", "system.dictionaries.items.update"],
        available: true
    },
    {
        key: 'parameters',
        name: '系统参数',
        path: '/admin/parameters',
        permission: 'system.parameters.read',
        operations: ["system.parameters.read", "system.parameters.update", "system.parameters.security.update"],
        available: true
    },
    {
        key: 'users',
        name: '账号管理',
        path: '/admin/users',
        permission: 'system.users.read',
        operations: ["system.users.read", "system.users.create", "system.users.update", "system.users.assign_roles", "system.users.reset_password", "system.users.delete"],
        available: true
    },
    {
        key: 'roles',
        name: '角色管理',
        path: '/admin/roles',
        permission: 'system.roles.read',
        operations: ["system.roles.read", "system.roles.create", "system.roles.update", "system.roles.assign_permissions", "system.roles.assign_menus", "system.roles.delete"],
        available: true
    },
    {
        key: 'menus',
        name: '菜单管理',
        path: '/admin/menus',
        permission: 'system.menus.read',
        operations: ["system.menus.read", "system.menus.create", "system.menus.update", "system.menus.delete"],
        available: true
    },
    {
        key: 'website_page',
        name: '网页维护',
        path: '/admin/website/:code',
        permission: 'content.pages.read',
        operations: ['content.pages.read','content.pages.update','content.pages.publish','content.pages.delete'],
        available: true,
        repeatable: true
    },
]

export const menuGroups = [
 {code:'inquiries_center',iconKey:'file-text',name:'客户咨询',sortOrder:70},
 {code:'careers_center',iconKey:'file-text',name:'招聘中心',sortOrder:65},
 {code:'news_center',iconKey:'file-text',name:'新闻中心',sortOrder:60},
    {code:'site_maintenance',iconKey:'globe',name:'全站维护',sortOrder:45},
    {code:'page_maintenance',iconKey:'globe',name:'页面维护',sortOrder:50},
    {code: 'account_access', iconKey: 'user-round-cog', name: '账号与权限', sortOrder: 100},
    {code: 'system_config', iconKey: 'settings-2', name: '系统配置', sortOrder: 200},
    {code: 'logs_audit', iconKey: 'scroll-text', name: '日志与审计', sortOrder: 300},
] as const
export const initialMenus = [
    ...menuGroups.map(group => ({...group, pageKey: null, parentCode: null})),
 {code:'career_positions',iconKey:'file-text',pageKey:'career_positions',name:'岗位管理',sortOrder:100,parentCode:'careers_center'},
 {code:'customer_inquiries',iconKey:'file-text',pageKey:'customer_inquiries',name:'咨询列表',sortOrder:100,parentCode:'inquiries_center'},
 {code:'customer_inquiry_settings',iconKey:'settings-2',pageKey:'customer_inquiry_settings',name:'咨询类型',sortOrder:200,parentCode:'inquiries_center'},
 {code:'customer_inquiry_mail_settings',iconKey:'mail',pageKey:'customer_inquiry_mail_settings',name:'邮件设置',sortOrder:300,parentCode:'inquiries_center'},
 {code:'news_articles',iconKey:'file-text',pageKey:'news_articles',name:'文章管理',sortOrder:100,parentCode:'news_center'},
 {code:'news_categories',iconKey:'folder-tree',pageKey:'news_categories',name:'新闻分类',sortOrder:200,parentCode:'news_center'},
    {code:'media_library',iconKey:'image',pageKey:'media',name:'媒体库',sortOrder:400,parentCode:null},
    {code:'site_settings',iconKey:'globe',pageKey:'site_settings',name:'网站标识',sortOrder:0,parentCode:'site_maintenance'},
    ...(['header','footer'] as const).map((section,index)=>({code:'site_'+section,iconKey:'globe',pageKey:'site_'+section,name:section==='header'?'页头维护':'页脚维护',sortOrder:(index+1)*10,parentCode:'site_maintenance'})),
    {code:'site_modules',iconKey:'layers',pageKey:'site_modules',name:'模块管理',sortOrder:34,parentCode:'site_maintenance'},
    {code:'site_languages',iconKey:'globe',pageKey:'site_languages',name:'站点语言',sortOrder:35,parentCode:'site_maintenance'},
    {code:'website_routes',iconKey:'globe',pageKey:'website_routes',name:'路由与 SEO',sortOrder:40,parentCode:'site_maintenance'},
    {code:'website_templates',iconKey:'file-text',pageKey:'website_templates',name:'区块模板',sortOrder:35,parentCode:'site_maintenance'},
    {code: 'system_environment', iconKey: 'monitor', pageKey: 'environment', name: '系统环境', sortOrder: 400, parentCode: 'system_config'},
    {code: 'users', iconKey: 'users', pageKey: 'users', name: '账号管理', sortOrder: 100, parentCode: 'account_access'},
    {
        code: 'roles',
        iconKey: 'shield-check',
        pageKey: 'roles',
        name: '角色管理',
        sortOrder: 200,
        parentCode: 'account_access'
    },
    {
        code: 'menus',
        iconKey: 'folder-tree',
        pageKey: 'menus',
        name: '菜单管理',
        sortOrder: 300,
        parentCode: 'account_access'
    },
    {
        code: 'parameters',
        iconKey: 'sliders-horizontal',
        pageKey: 'parameters',
        name: '系统参数',
        sortOrder: 100,
        parentCode: 'system_config'
    },
    {
        code: 'dictionaries',
        iconKey: 'book-open',
        pageKey: 'dictionaries',
        name: '数据字典',
        sortOrder: 200,
        parentCode: 'system_config'
    },
    {
        code: 'scheduled_tasks',
        iconKey: 'clock',
        pageKey: 'tasks',
        name: '定时任务',
        sortOrder: 300,
        parentCode: 'system_config'
    },
    {
        code: 'login_logs',
        iconKey: 'log-in',
        pageKey: 'login_logs',
        name: '登录日志',
        sortOrder: 100,
        parentCode: 'logs_audit'
    },
    {
        code: 'audit_logs',
        iconKey: 'scroll-text',
        pageKey: 'audit_logs',
        name: '操作审计',
        sortOrder: 200,
        parentCode: 'logs_audit'
    },
    {
        code: 'security_logs',
        iconKey: 'shield-alert',
        pageKey: 'security_logs',
        name: '安全事件',
        sortOrder: 300,
        parentCode: 'logs_audit'
    },
] as const

// 树规模硬边界，不是管理员可调整的业务策略。根节点计作第 1 层。
export const MAX_MENU_DEPTH = 8
export const MAX_MENU_COUNT = 500
