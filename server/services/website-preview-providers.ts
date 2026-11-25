// 预览数据扩展集中选择业务样本字段，页面投影通过此入口取得补充数据。
import type {DatabaseExecutor} from '../db/transaction'
import {websiteTemplateRepository} from '../repositories/website-templates'
import type {WebsitePreviewData, WebsiteTemplateSample} from '#shared/types/admin/website-preview'

type PreviewProvider = (sample: WebsiteTemplateSample) => WebsitePreviewData

const providers: readonly PreviewProvider[] = [
    sample => sample.article ? {article: sample.article} : {},
    sample => sample.positions ? {positions: sample.positions} : {},
    sample => sample.inquiryCategories ? {inquiryCategories: sample.inquiryCategories} : {},
]

export async function websitePreviewData(db: DatabaseExecutor, templateKeys: readonly string[]): Promise<WebsitePreviewData> {
    const result: WebsitePreviewData = {}
    for (const key of new Set(templateKeys)) {
        const sample = await websiteTemplateRepository.sample(db, key)
        if (sample) {
            for (const provide of providers) Object.assign(result, provide(sample))
        }
    }
    return result
}
