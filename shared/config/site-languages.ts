// 系统具备的语言资源；站点公开范围由已发布的语言配置决定。
export const supportedLanguageCatalog = [
    {code: 'en', name: 'English', adminName: 'English', language: 'en', file: 'en.json'},
    {code: 'fr', name: 'Français', adminName: 'Français', language: 'fr', file: 'fr.json'},
    {code: 'es', name: 'Español', adminName: 'Español', language: 'es', file: 'es.json'},
    {code: 'pt', name: 'Português', adminName: 'Português', language: 'pt', file: 'pt.json'},
    {code: 'zh', name: '简体中文', adminName: '中文', language: 'zh-CN', file: 'zh.json'},
] as const
export type SupportedLocale = typeof supportedLanguageCatalog[number]['code']
export const supportedLocales = supportedLanguageCatalog.map(language => language.code)

export interface SiteLanguages {
    enabledLocales: SupportedLocale[];
    defaultLocale: SupportedLocale
}

// 后台界面和内容管理的首选语言；与数据库控制的官网启用范围、默认语言分开。
export const adminContentLocale: SupportedLocale = 'zh'
export const adminHtmlLanguage = supportedLanguageCatalog.find(language => language.code === adminContentLocale)!.language
// 初次安装的默认值；已发布站点始终读取数据库语言配置。
export const defaultSiteLanguages: SiteLanguages = {
    enabledLocales: [adminContentLocale, ...supportedLocales.filter(locale => locale !== adminContentLocale)],
    defaultLocale: 'en'
}
