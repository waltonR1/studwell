import {describe, expect, it} from 'vitest'
import {publicLocalizedQuerySchema, publicNewsListQuerySchema, publicPageParamsSchema} from '../../shared/schemas/public/queries'

describe('目标公开 API 查询合同', () => {
  it('语言省略交由站点解析，每页 12 条且推荐筛选默认关闭', () => {
    expect(publicLocalizedQuerySchema.parse({})).toEqual({})
    expect(publicNewsListQuerySchema.parse({})).toEqual({page: 1, pageSize: 12, featured: false})
    expect(publicNewsListQuerySchema.parse({locale: 'pt', page: '2', pageSize: '100', featured: 'true', category: 'company'}))
      .toEqual({locale: 'pt', page: 2, pageSize: 100, featured: true, category: 'company'})
    expect(publicNewsListQuerySchema.parse({featured: 'false'}).featured).toBe(false)
  })
  it.each(['zh', 'en', 'fr', 'es', 'pt'])('支持语言 %s', locale => {
    expect(publicLocalizedQuerySchema.parse({locale}).locale).toBe(locale)
  })
  it.each([
    {locale: 'zh-CN'}, {locale: ''}, {locale: ['zh', 'en']}, {sort: 'id'},
    {page: '0'}, {page: '-1'}, {page: '1.5'}, {page: '1e2'}, {page: '01'},
    {page: ''}, {page: 1}, {page: ['1', '2']}, {page: '100001'},
    {pageSize: '101'}, {pageSize: '0'}, {pageSize: '1.0'},
    {featured: '1'}, {featured: true}, {featured: ['true', 'false']},
    {category: ''}, {category: ['company']}, {category: 'UPPER'},
  ])('拒绝非法或未登记参数 %j', query => {
    expect(publicNewsListQuerySchema.safeParse(query).success).toBe(false)
  })
  it('页面不接受额外裁剪参数，路径 key 校验保持严格', () => {
    expect(publicLocalizedQuerySchema.safeParse({slug: 'cement'}).success).toBe(false)
    expect(publicPageParamsSchema.parse({key: 'products'})).toEqual({key: 'products'})
    expect(publicPageParamsSchema.safeParse({key: '../about'}).success).toBe(false)
  })
})
