// 协调公开新闻业务规则、权限及持久化调用，不直接处理 HTTP 或 ORM。
import {requiredLocalized} from '../policies/localized'
import {readModuleImageRules} from '../repositories/website-image-rules'
import type {ModuleImageRules} from '#shared/schemas/admin/image-rules'
import {requireSiteModule} from './site-modules'
import {resolvePublicLocale} from './site-languages'
import type {Database,DatabaseExecutor} from '../db/transaction'
import {publicNewsRepository as repo, type PublicNewsRow} from '../repositories/public-news'
import {ApiError} from '../core/errors'
import {parseInput} from '../core/validation'
import {publicNewsListQuerySchema, publicNewsParamsSchema, publicLocalizedQuerySchema, type PublicLocale} from '#shared/schemas/public/queries'
import type {PublicNewsSummary, PublicNewsArticle, PublicNewsImage, PublicNewsBlock} from '#shared/types/public/news'
import type {PublicNewsList} from '#shared/types/public/news-list'
import type {ImagePresentation,ImageRule} from '#shared/types/image-presentation'
import {createPublicMediaResolver} from './public-media'
import {readNewsOperations} from './news-operations'

function project(resolve: ReturnType<typeof createPublicMediaResolver>, locale: PublicLocale,rules:ModuleImageRules) {
  const image = async (id: string, alt: string, imagePreset:ImageRule, presentation?: ImagePresentation): Promise<PublicNewsImage> =>
    ({src: (await resolve(id, 'image')).src, alt, imagePreset, ...(presentation ? {presentation} : {})})
  const summary = async (row: PublicNewsRow): Promise<PublicNewsSummary> => {
    const t = requiredLocalized(row.content.localized,locale)
    return {
      id: String(row.articleId), slug: row.slug, category: {id: row.categoryCode, name: requiredLocalized(row.categoryName,locale)},
      title: t.title, summary: t.summary, publishedAt: row.content.displayDate,
      coverImage: row.content.coverMediaId ? await image(row.content.coverMediaId, t.title, rules.newsCover, row.content.coverPresentation ?? undefined) : null,
    }
  }
  return {image, summary}
}

async function assertNewsOnline(db:DatabaseExecutor){
  await requireSiteModule(db,'news')
}

export function createPublicNewsService(db: Database) {
  return {
    async list(raw: unknown): Promise<PublicNewsList> {
      const parsed = await parseInput(publicNewsListQuerySchema, raw)
      return db.transaction(async tx => {
        const q={...parsed,locale:await resolvePublicLocale(tx,parsed.locale)}
        await assertNewsOnline(tx)
        const categories = (await repo.categories(tx)).map(c => ({id: c.code, name: requiredLocalized(c.name,q.locale)}))
        if (q.category && !categories.some(c => c.id === q.category)) throw new ApiError('NOT_FOUND')
        const result = await repo.list(tx, q, q.featured)
        const {summary} = project(createPublicMediaResolver(tx), q.locale,await readModuleImageRules(tx))
        return {locale: q.locale, categories, items: await Promise.all(result.items.map(summary)), total: result.total, page: q.page, pageSize: q.pageSize}
      }, {isolationLevel: 'repeatable read'})
    },
    async recordView(slug:unknown):Promise<{viewCount:number|null}>{
      const params=await parseInput(publicNewsParamsSchema,{slug})
      return db.transaction(async tx=>{
        await assertNewsOnline(tx)
        const row=await repo.detail(tx,params.slug)
        if(!row)throw new ApiError('NOT_FOUND')
        return {viewCount:(await readNewsOperations(tx)).viewCountEnabled?await repo.incrementViews(tx,row):null}
      },{isolationLevel:'read committed'})
    },
    async detail(slug: unknown, raw: unknown): Promise<PublicNewsArticle> {
      const params = await parseInput(publicNewsParamsSchema, {slug})
      const parsed = await parseInput(publicLocalizedQuerySchema, raw)
      return db.transaction(async tx => {
        const locale=await resolvePublicLocale(tx,parsed.locale)
        await assertNewsOnline(tx)
        const row = await repo.detail(tx, params.slug)
        if (!row) throw new ApiError('NOT_FOUND')
        const t = requiredLocalized(row.content.localized,locale)
        const rules=await readModuleImageRules(tx)
        const {image, summary} = project(createPublicMediaResolver(tx), locale,rules)
        const body = await Promise.all(t.body.map(async (block): Promise<PublicNewsBlock> => block.type === 'image'
          ? {type: 'image', image: await image(block.image.mediaId, block.image.alt, rules.newsBody, block.image.presentation), caption: block.caption}
          : block))
        return {...await summary(row), viewCount:(await readNewsOperations(tx)).viewCountEnabled?row.viewCount:null, body, seoTitle: t.seoTitle || t.title, seoDescription: t.seoDescription || t.summary,
          source: t.sourceName || t.sourceUrl ? {name: t.sourceName, url: t.sourceUrl} : null}
      }, {isolationLevel: 'repeatable read'})
    },
  }
}
