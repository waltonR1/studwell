// 搜索模板与索引生成器共用的契约；产品内容按普通页面收录。
import type {PublicLocale} from '../schemas/public/queries'

import type {searchCategories, searchSchemaVersion} from '../config/website/search'

export type SearchType = typeof searchCategories[number]

export interface SearchDocument {
    id: string
    locale: PublicLocale
    type: SearchType
    path: string
    title: string
    code?: string
    aliases: string[]
    categoryPath: string[]
    summary: string
    body: string
    publishedAt?: string
}

export interface SearchIndex {
    schemaVersion: typeof searchSchemaVersion;
    version: string;
    locale: PublicLocale;
    documents: SearchDocument[]
}

export interface SearchManifest {
    modulePolicyVersion: number;
    schemaVersion: typeof searchSchemaVersion;
    configReleaseId:string|null;
    languageReleaseId:string|null;
    modules: {news:boolean;careers:boolean};
    languages: import('../config/site-languages').SiteLanguages;
    versions: Partial<Record<PublicLocale, string>>
}
