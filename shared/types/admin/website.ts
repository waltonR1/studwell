// 后台页面、区块、模板及发布记录响应，模板采用完整管理修订合同。
import type {WebsitePageSettings} from '../../schemas/website/page-settings'
import type {SiteRelease} from './site-settings'

export interface WebsitePublication {
    stateVersion: number;
    status: 'unpublished' | 'published' | 'offline';
    changed: boolean;
    draftVersion: number;
    publishedReleaseId: string | null;
    publishedDraftVersion: number | null;
    releases: SiteRelease[]
}

export interface WebsiteReleaseDetail extends SiteRelease {
    resourceKey: string;
    isCurrent: boolean;
    content: unknown
}

import type {WebsiteSectionUpdate} from '../../schemas/admin/website-pages'
import type {SectionTemplateRevision} from './section-template'

export interface WebsiteTemplateRecord {
    businessModules?: WebsiteBusinessModule[];
    coverMediaId: string | null;
    id: string;
    key: string;
    name: string;
    description: string;
    enabledForNew: boolean;
    metadataVersion: number;
    revision?: number | null;
    definition: SectionTemplateRevision | null
}

// 模板目录的展示投影；页面装配使用的模板合同不携带管理页面名称。
export interface WebsiteTemplateCatalogRecord extends WebsiteTemplateRecord {
    applicablePages: 'all' | Array<{key:string;name:string|null}> | null
}

export interface WebsiteSectionRecord {
    businessModules?: WebsiteBusinessModule[];
    id: string;
    templateId: string;
    templateKey: string;
    name: string;
    sortOrder: number;
    visible: boolean;
    anchorKey: string;
    contentVersion: number;
    structureVersion: number;
    shared: WebsiteSectionUpdate['shared'];
    localized: WebsiteSectionUpdate['localized'];
    definition: SectionTemplateRevision | null
}

export interface WebsiteBusinessModule {
    key: 'news' | 'careers' | 'inquiries';
    name: string;
    enabled: boolean;
    path: string
}

export interface WebsitePageRecord {
    resourceId: string | null;
    persisted: boolean;
    scopeGranted: boolean;
    key: string;
    name: string;
    resourceKey: string;
    routePath: string | null;
    version: number;
    settingsVersion: number;
    settings: WebsitePageSettings;
    sections: WebsiteSectionRecord[];
    templates: WebsiteTemplateRecord[];
    publication: WebsitePublication;
    updatedAt: string;
    updatedBy: string
}

