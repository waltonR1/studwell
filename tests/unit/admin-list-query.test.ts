import { describe, expect, it, vi } from 'vitest'
// 单元环境不启动 Nuxt，别名替身仍读取同一份真实 shared 配置。
vi.mock('#shared/config/admin/pagination', () => import('../../shared/config/admin/pagination'))
import {
  buildAdminListQuery,
  readAdminListRoute,
} from '../../app/utils/admin/list/query'
import type {AdminListDraft, AdminListRouteState} from '../../app/types/admin/list'

const applied: AdminListRouteState = {
  search: 'audit_01',
  filter: 'enabled',
  page: 2,
  pageSize: 10,
}

function queryFor(action: Parameters<typeof buildAdminListQuery>[0]['action'], draft: AdminListDraft) {
  return buildAdminListQuery({ applied, draft, action, filterKey: 'status' })
}

describe('后台列表查询状态', () => {
  it('严格读取 URL，并忽略非法状态、页码与条数', () => {
    expect(readAdminListRoute({
      search: 'audit',
      status: 'enabled',
      page: '3',
      pageSize: '20',
    }, 'status', ['enabled', 'disabled'])).toEqual({
      search: 'audit',
      filter: 'enabled',
      page: 3,
      pageSize: 20,
    })
    expect(readAdminListRoute({
      status: 'arbitrary',
      page: '0',
      pageSize: '25',
    }, 'status', ['enabled', 'disabled'])).toEqual({
      search: '',
      filter: '',
      page: 1,
      pageSize: undefined,
    })
  })

  it('页码必须为安全整数且分页偏移不能溢出', () => {
    for (const page of ['9007199254740992', '9007199254740993', '9'.repeat(310)]) {
      expect(readAdminListRoute({ page, pageSize: '10' }, 'status', ['enabled', 'disabled'])).toEqual({
        search: '',
        filter: '',
        page: 1,
        pageSize: 10,
      })
    }
    expect(readAdminListRoute({ page: '180143985094821', pageSize: '50' }, 'status', ['enabled', 'disabled']).page).toBe(1)
    expect(readAdminListRoute({ page: '180143985094820', pageSize: '50' }, 'status', ['enabled', 'disabled']).page).toBe(180143985094820)
    expect(readAdminListRoute({ page: '2' }, 'status', ['enabled', 'disabled']).page).toBe(2)
  })

  it('分页和条数操作只使用已生效关键词，输入草稿不会进入 URL', () => {
    const draft = { search: 'unsubmitted', filter: 'disabled', pageSize: '50' }
    expect(queryFor({ type: 'page', page: 3 }, draft)).toEqual({
      search: 'audit_01',
      status: 'enabled',
      page: '3',
      pageSize: '10',
    })
    expect(queryFor({ type: 'pageSize' }, draft)).toEqual({
      search: 'audit_01',
      status: 'enabled',
      page: '1',
      pageSize: '50',
    })
  })

  it('明确搜索或筛选会应用对应草稿并回到第一页', () => {
    const draft = { search: '  audit_02  ', filter: 'disabled', pageSize: '20' }
    expect(queryFor({ type: 'search' }, draft)).toEqual({
      search: 'audit_02',
      status: 'enabled',
      page: '1',
      pageSize: '10',
    })
    expect(queryFor({ type: 'filter' }, draft)).toEqual({
      search: 'audit_01',
      status: 'disabled',
      page: '1',
      pageSize: '10',
    })
  })

  it('无显式条数时保留参数默认合同，不伪造 URL 参数', () => {
    const withoutPageSize = { ...applied, pageSize: undefined }
    expect(buildAdminListQuery({
      applied: withoutPageSize,
      draft: { search: 'draft', filter: '', pageSize: '20' },
      action: { type: 'page', page: 2 },
      filterKey: 'status',
    })).toEqual({
      search: 'audit_01',
      status: 'enabled',
      page: '2',
    })
  })

  it('程序生成的下一页仍须通过安全页码校验', () => {
    expect(queryFor({ type: 'page', page: Number.MAX_SAFE_INTEGER }, { search: '', filter: '', pageSize: '50' }).page).toBe('1')
    expect(queryFor({ type: 'page', page: Number.POSITIVE_INFINITY }, { search: '', filter: '', pageSize: '50' }).page).toBe('1')
  })

  it('不分页列表的搜索与筛选互相独立且不产生页码参数', () => {
    expect(buildAdminListQuery({
      applied: { search: 'system', filter: 'visible', page: 1, pageSize: undefined },
      draft: { search: 'dictionary', filter: 'hidden', pageSize: '20' },
      action: { type: 'filter' },
      filterKey: 'visibility',
      paginated: false,
    })).toEqual({
      search: 'system',
      visibility: 'hidden',
    })
    expect(buildAdminListQuery({
      applied: { search: 'system', filter: 'visible', page: 1, pageSize: undefined },
      draft: { search: ' dictionary ', filter: 'hidden', pageSize: '20' },
      action: { type: 'search' },
      filterKey: 'visibility',
      paginated: false,
    })).toEqual({
      search: 'dictionary',
      visibility: 'visible',
    })
  })
})
