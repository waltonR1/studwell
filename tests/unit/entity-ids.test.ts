import {describe, expect, it} from 'vitest'
import {decodeEntityId, entityIdTypes} from '../../server/db/entity-ids'

describe('实体编号解析', () => {
    it('网页实体使用当前连续类型码', () => {
        for (const [code, table] of [['16', 'website_navigation'], ['17', 'website_releases'], ['18', 'website_resources'], ['19', 'website_templates'], ['20', 'website_sections']]) {
            expect(decodeEntityId(`20261102${code}000000001`)?.table).toBe(table)
        }
        expect(decodeEntityId('2026110229000000001')?.table).toBe('website_site_config_releases')
        expect(decodeEntityId('2026110222000000001')?.table).toBe('news_articles')
    })
    it('现行类型码连续且互不重复', () => {
        expect(Object.values(entityIdTypes)).toEqual(Array.from({length: 30}, (_, index) => String(index + 1).padStart(2, '0')))
    })
    it('解析日期、类型和流水', () => {
        expect(decodeEntityId('2026102801000000001')).toEqual({date: '20261028', type: '01', table: 'admin_users', sequence: '000000001'})
    })
    it('拒绝无效日期、类型、长度和零流水', () => {
        for (const value of ['1', '2026023001000000001', '2026130101000000001', '2026102899000000001', '2026102801000000000']) expect(decodeEntityId(value)).toBeNull()
    })
})
