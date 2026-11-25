// 验证安全边界；全部使用虚构连接，不触达真实数据库。
import { describe, expect, it } from 'vitest'
import { validateTestDatabase } from '../database/connection.mjs'

const valid = { NODE_ENV: 'test', TEST_DATABASE_URL: 'mysql://test:example@localhost/studwell_test', TEST_DATABASE_NAME: 'studwell_test', NUXT_DATABASE_URL: 'mysql://app:example@localhost/studwell_dev' }

describe('专用测试库保护', () => {
  it('接受显式指定且独立的测试库', () => {
    expect(validateTestDatabase(valid).name).toBe('studwell_test')
  })
  it.each([
    { NODE_ENV: 'production' },
    { TEST_DATABASE_URL: '' },
    { TEST_DATABASE_NAME: '' },
    { TEST_DATABASE_URL: 'mysql://test:example@localhost/studwell_dev' },
    { TEST_DATABASE_NAME: 'studwell_dev', TEST_DATABASE_URL: 'mysql://test:example@localhost/studwell_dev' },
    { TEST_DATABASE_URL: 'postgres://test:example@localhost/studwell_test' },
    { TEST_DATABASE_URL: 'malformed' },
    { NUXT_DATABASE_URL: 'mysql://app:example@127.0.0.1/studwell_test' },
    { DATABASE_MIGRATION_URL: 'mysql://migration:example@other-host/STUDWELL_TEST' },
    { TEST_DATABASE_URL: 'mysql://test:example@localhost/studwell_test%2Fextra' },
  ])('拒绝危险或不完整配置：%j', patch => {
    expect(() => validateTestDatabase({ ...valid, ...patch })).toThrow()
  })
})
