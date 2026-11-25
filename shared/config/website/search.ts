// 官网搜索索引的格式版本、分类和缓存命名，属于跨端协议常量而非站点业务配置。
export const searchSchemaVersion = 2 as const
export const searchCategories = ['news', 'pages'] as const
export const searchFilters = ['all', ...searchCategories] as const
export const searchCacheNamespace = 'website:search:index'
