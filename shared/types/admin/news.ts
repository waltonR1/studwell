// 新闻后台分类、草稿、发布历史及管理响应，公开文章使用独立类型。
import type {NewsContent, NewsCategoryInput} from '../../schemas/admin/news'
import type {SiteRelease} from './site-settings'

export interface NewsOperations {
    viewCountEnabled: boolean;
    version: number
}

export interface NewsCategory extends NewsCategoryInput {
    id: string;
    version: number
}

export interface NewsArticle {
    id: string;
    slug: string;
    viewCount: number;
    content: NewsContent;
    version: number;
    stateVersion: number;
    publishedReleaseId: string | null;
    status: 'published' | 'offline' | 'unpublished';
    changed: boolean;
    updatedAt: string;
    releases: SiteRelease[]
}

export interface NewsArticleList {
    items: NewsArticle[];
    total: number;
    page: number;
    pageSize: number
}

export interface NewsRelease extends SiteRelease {
    content: NewsContent;
    isCurrent: boolean
}
