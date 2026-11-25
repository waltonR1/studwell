import {describe, expect, it} from 'vitest'
import {
    buildInquiryListQuery,
    inquiryListDateProblem,
    readInquiryListRoute,
    type InquiryListDraft,
} from '../../app/utils/admin/inquiries/list-query'

const applied = readInquiryListRoute({
    search:'customer@example.com',
    queue:'mine',
    status:'awaiting_reply',
    category:'export',
    assigneeId:'10',
    from:'2026-11-01',
    to:'2026-11-10',
    page:'2',
    pageSize:'20',
}, 20)

const draft: InquiryListDraft = {
    search:'  new@example.com ',
    queue:'unassigned',
    status:'pending',
    category:'investment',
    assigneeId:'11',
    from:'2026-11-03',
    to:'2026-11-09',
    pageSize:'50',
}

describe('客户咨询列表查询状态', () => {
    it('严格读取多条件筛选与分页', () => {
        expect(applied).toEqual({
            search:'customer@example.com',
            queue:'mine',
            status:'awaiting_reply',
            category:'export',
            assigneeId:'10',
            from:'2026-11-01',
            to:'2026-11-10',
            page:2,
            pageSize:20,
        })
        expect(readInquiryListRoute({
            queue:'unknown',
            status:'unknown',
            category:'INVALID',
            assigneeId:'0',
            from:'2026-11-10',
            to:'2026-11-09',
            page:'0',
            pageSize:'25',
        }, 20)).toMatchObject({
            page:1,
            pageSize:20,
            queue:undefined,
            status:undefined,
            category:undefined,
            assigneeId:undefined,
            to:undefined,
        })
    })

    it('查询应用全部筛选草稿并回到第一页', () => {
        expect(buildInquiryListQuery(applied, draft, {type:'search'}, 20)).toMatchObject({
            search:'new@example.com',
            queue:'unassigned',
            status:'pending',
            category:'investment',
            assigneeId:'11',
            from:'2026-11-03',
            to:'2026-11-09',
            page:1,
        })
    })

    it('单项筛选只更新对应条件', () => {
        expect(buildInquiryListQuery(applied, draft, {type:'filter', key:'category'}, 20)).toMatchObject({
            search:'customer@example.com',
            queue:'mine',
            status:'awaiting_reply',
            category:'investment',
            page:1,
        })
    })

    it('切换工作队列时清除冲突的状态和负责人条件', () => {
        expect(buildInquiryListQuery(applied, draft, {type:'queue'}, 20)).toMatchObject({
            queue:'unassigned',
            status:undefined,
            assigneeId:undefined,
            page:1,
        })
    })

    it('页大小与页码通过统一约束处理', () => {
        expect(buildInquiryListQuery(applied, draft, {type:'pageSize'}, 20)).toMatchObject({page:1, pageSize:50})
        expect(buildInquiryListQuery(applied, draft, {type:'page', page:3}, 20)).toMatchObject({page:3, pageSize:20})
        expect(inquiryListDateProblem({from:'2026-11-10', to:'2026-11-09'})).toBe('结束日期不能早于开始日期。')
    })
})
