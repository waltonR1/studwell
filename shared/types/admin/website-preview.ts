// 后台预览和模板样例载荷，组合公开投影但不参与官网正式运行。
import type {PublicCareerPosition} from '../public/careers'
import type {PublicInquiryCategory} from '../../schemas/public/inquiries'
import type {PublicNewsArticle} from '../public/news'
import type {PublicSiteSettings, WebsitePageView} from '../public/website'

export interface WebsitePreviewData {
    article?: PublicNewsArticle
    positions?: PublicCareerPosition[]
    inquiryCategories?: PublicInquiryCategory[]
}

export interface WebsitePagePreviewView extends WebsitePageView {
    previewData?: WebsitePreviewData
    previewSettings?: PublicSiteSettings
}

export interface WebsiteTemplateSample extends WebsitePreviewData {
    view: WebsitePageView
    settings: PublicSiteSettings
}
