// 官网页面结构、内容、媒体和站点配置的公开投影，不包含后台编辑布局。
import type {SitePageTarget} from '../website/link-target'
import type {PublicLocale} from '../../schemas/public/queries'
import type {ImagePresentation, ImageRule, ImageReference} from '../image-presentation'

export interface PublicSeo {
    title: string;
    description: string;
    indexable?: boolean;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: PublicMedia
}

export interface PublicMedia {
    id: string;
    src: string;
    kind: 'image' | 'video';
    mime: string;
    presentation?: ImagePresentation;
    imagePreset?: ImageRule
}

// 展示设置属于具体使用位置，同一资产可以被不同取景引用。
export interface PublicImageReference extends ImageReference {
    imagePreset?: ImageRule
}

export type PublicLinkTarget = SitePageTarget | { type: 'custom'; value: string }

export interface PublicLink {
    id: string;
    label: string;
    target: PublicLinkTarget
}

export interface PublicSiteSettings {
    modulePolicyVersion: number
    modules?: { news: boolean; careers: boolean }
    languages: import('../../config/site-languages').SiteLanguages
    configReleaseId?:string|null
    languageReleaseId?:string|null
    locale: PublicLocale
    pages: Record<string, PublicPageStructure>
    basic: { logo: PublicMedia | null; favicon: PublicMedia | null } | null
    header: { tagline: string; items: Array<PublicLink & { children: PublicLink[] }> } | null
    footer: {
        contactTarget: PublicLinkTarget | null
        contactTitle: string
        contacts: Array<{ id: string; kind: 'email' | 'phone' | 'text'; label: string; value: string }>
        description: string
        copyrightHolder: string
        groups: Array<{ id: string; title: string; items: PublicLink[] }>
    } | null
}

// 模板内容经模板字段白名单校验；媒体字段保留 {mediaId}，从页面 media 表解析。
export type PublicContentValue = string | number | boolean | null | PublicImageReference | PublicContentValue[] | {
    [key: string]: PublicContentValue
}

export interface PublicSection {
    capabilities: string[]
    id: string
    renderer: string
    templateKey: string
    sortOrder: number
    anchorKey: string
    shared: { media: Array<PublicImageReference & { key: string }> }
    content: Record<string, PublicContentValue>
}

export interface PublicPageStructure {
    linkLocations: Record<string, { queryKey: string; anchorKey: string | null }>
    resourceId: string
    configReleaseId?:string|null
    languageReleaseId?:string|null
    displayName: string
    path: string
    key: string
    releaseId: string
    sceneEnabled: boolean
    sceneTransitionSeconds: number | null
    seo: PublicSeo
    sections: Array<Pick<PublicSection, 'id' | 'templateKey' | 'sortOrder' | 'anchorKey'> & { capabilities: string[] }>
}

export interface PublicPage {
    configReleaseId?:string|null
    languageReleaseId?:string|null
    key: string
    locale: PublicLocale
    releaseId: string
    sections: Array<Pick<PublicSection, 'id' | 'renderer' | 'shared' | 'content'>>
    media: Record<string, PublicMedia>
}

export interface WebsitePageView {
    page: PublicPage;
    structure: PublicPageStructure
}
