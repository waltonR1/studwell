// 识别已发布的新闻列表页，供新闻索引快照和文档生成共用。
import type {PublicPageStructure} from '#shared/types/public/website'

export function isNewsSearchPage(page: Pick<PublicPageStructure, 'sections'>) {
    return page.sections.some(section => section.capabilities.includes('news.list'))
}
