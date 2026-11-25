// 后台站点设置、链接候选、发布状态及历史详情的响应合同。
import type {SiteSection, SiteSettings, SiteLink} from '../../schemas/admin/site-settings'
import type {PublicationRelease} from './publication-history'

export interface SiteTarget {
    resourceId: string;
    key: string;
    label: Record<string, string>;
    target: Exclude<SiteLink['target'], { type: 'custom' }>;
    path: string
}

export interface SiteRelease extends PublicationRelease {
    draftVersion: number;
}

export interface SitePublication {
    stateVersion: number;
    changedSections: SiteSection[];
    draftVersion: number;
    publishedReleaseId: string | null;
    publishedDraftVersion: number | null;
    releases: SiteRelease[]
}

export interface SiteSettingsRecord {
    publication?: Record<SiteSection, SitePublication>;
    versions: Record<SiteSection, number>;
    content: SiteSettings;
    updatedAt: string | null;
    updatedBy: string | null;
    targets: SiteTarget[]
}

export interface SiteReleaseDetail extends SiteRelease {
    section: SiteSection;
    content: Partial<SiteSettings>;
    isCurrent: boolean
}
