import {describe, expect, it} from 'vitest'
import {templateBusinessModules, templateBusinessDisabled, templateBusinessLabel} from '../../app/utils/admin/website/template-business'

describe('template business presentation', () => {
    it('leaves ordinary and older template responses usable', () => {
        expect(templateBusinessModules(undefined)).toEqual([])
        expect(templateBusinessDisabled({name: '普通模板'})).toBe(false)
        expect(templateBusinessLabel({name: '普通模板'})).toBe('普通模板')
    })

    it('uses server module names and marks any disabled dependency', () => {
        const template = {name: '动态', businessModules: [
            {key: 'news' as const, name: '新闻', enabled: true, path: '/admin/news'},
            {key: 'inquiries' as const, name: '询盘', enabled: false, path: '/admin/inquiries'}
        ]}
        expect(templateBusinessDisabled(template)).toBe(true)
        expect(templateBusinessLabel(template)).toBe('动态 · 新闻 · 询盘（业务已停用）')
        expect(templateBusinessModules(template)).toEqual(template.businessModules)
    })
})
