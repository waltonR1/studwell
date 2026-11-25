// 协调公开招聘业务规则、权限及持久化调用，不直接处理 HTTP 或 ORM。
import {requiredLocalized} from '../policies/localized'
import {requireSiteModule} from './site-modules'
import {resolvePublicLocale} from './site-languages'
import type {Database} from '../db/transaction'
import type {PublicCareerPosition} from '#shared/types/public/careers'
import {publicLocalizedQuerySchema} from '#shared/schemas/public/queries'
import {careerRepository} from '../repositories/careers'
import {parseInput} from '../core/validation'

export function createPublicCareerService(db: Database) {
  return {
    async list(raw: unknown): Promise<PublicCareerPosition[]> {
      const parsed = await parseInput(publicLocalizedQuerySchema, raw)
      return db.transaction(async tx => {
        const locale=await resolvePublicLocale(tx,parsed.locale)
        await requireSiteModule(tx,'careers')
        const rows = await careerRepository.published(tx)
        return rows.map(({id, content}) => ({id: String(id), ...requiredLocalized(content.localized,locale)}))
      }, {isolationLevel: 'repeatable read'})
    },
  }
}
