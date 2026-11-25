// 业务数据语言类型：多语言实体独立于固定页面i18n，所有内容入口使用同一系统语言目录。
export type ContentLocale = import('#shared/config/site-languages').SupportedLocale
export type LocalizedContent<T> = Record<ContentLocale, T>
