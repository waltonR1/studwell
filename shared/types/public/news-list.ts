// 新闻列表同时交付当前语言的启用分类和分页结果。
import type {PageData} from '../api'
import type {PublicLocale} from '../../schemas/public/queries'
import type {PublicNewsSummary} from './news'

export interface PublicNewsCategory {
    id: string;
    name: string
}

export interface PublicNewsList extends PageData<PublicNewsSummary> {
    locale: PublicLocale
    categories: PublicNewsCategory[]
}
