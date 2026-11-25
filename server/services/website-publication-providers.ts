// 登记业务区块在语言或路由发布时需要执行的语言完整性校验。
import type {SupportedLocale} from '#shared/config/site-languages'
import type {DatabaseExecutor} from '../db/transaction'
import {ApiError} from '../core/errors'
import {publicNewsRepository} from '../repositories/public-news'
import {careerRepository} from '../repositories/careers'
import {readInquirySettings} from '../repositories/inquiry-settings'
import {assertNewsLanguages, assertCareerLanguages, assertInquiryLanguages} from '../policies/site-language-content'
import {snapshotHasCapability} from './website-capabilities'

interface PublicationProvider {
    capability: string
    validateLanguages(db: DatabaseExecutor, locales: readonly SupportedLocale[]): Promise<void>
}

const providers: readonly PublicationProvider[] = [
    {
        capability: 'news.list',
        async validateLanguages(db, locales) {
            for (const category of await publicNewsRepository.categories(db)) {
                for (const locale of locales) {
                    if (!category.name[locale]?.trim()) throw new ApiError('INVALID_INPUT', [{path: 'routes', message: '请补齐新闻分类 ' + category.code + ' 的 ' + locale + ' 名称。'}])
                }
            }
            for (const row of await publicNewsRepository.searchRows(db)) assertNewsLanguages(row.content, locales)
        },
    },
    {
        capability: 'careers.positions',
        async validateLanguages(db, locales) {
            for (const row of await careerRepository.published(db)) assertCareerLanguages(row.content, locales)
        },
    },
    {
        capability: 'inquiries.form',
        async validateLanguages(db, locales) {
            assertInquiryLanguages((await readInquirySettings(db)).settings, locales)
        },
    },
]

export async function validateWebsiteBusinessLanguages(db: DatabaseExecutor, snapshots: readonly unknown[], locales: readonly SupportedLocale[]) {
    for (const provider of providers) {
        if ((await Promise.all(snapshots.map(snapshot => snapshotHasCapability(db,snapshot,provider.capability)))).some(Boolean)) {
            await provider.validateLanguages(db, locales)
        }
    }
}
