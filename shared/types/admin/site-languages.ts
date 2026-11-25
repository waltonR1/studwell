// 站点语言拥有独立草稿和发布历史，不携带路由或 SEO 草稿。
import type {SiteLanguages} from '../../config/site-languages'
import type {PublicationRelease} from './publication-history'

export interface SiteLanguageState {
    languages: SiteLanguages;
    publishedLanguages: SiteLanguages;
    version: number;
    publishedReleaseId: string | null;
    releases: PublicationRelease[]
}
