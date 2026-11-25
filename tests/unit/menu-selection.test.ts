import { describe, expect, it } from 'vitest'
import { reconcileMenuSelection } from '../../app/utils/admin/roles/menu-selection'

describe('角色菜单目录同步', () => {
  it('首次加载或失败重试成功后初始化已选项与基线', () => {
    expect(reconcileMenuSelection({ selected: [], baseline: [], initialized: false }, ['10', '11'])).toEqual({
      selected: ['10', '11'],
      baseline: ['10', '11'],
      initialized: true,
    })
  })

  it('存在未保存草稿时保留选择，不因目录刷新静默覆盖', () => {
    const draft = { selected: ['10'], baseline: ['10', '11'], initialized: true }
    expect(reconcileMenuSelection(draft, ['10', '11', '12'])).toBe(draft)
  })

  it('无草稿的同步刷新采用服务端最新授权', () => {
    expect(reconcileMenuSelection({ selected: ['10', '11'], baseline: ['10', '11'], initialized: true }, ['10'])).toEqual({
      selected: ['10'],
      baseline: ['10'],
      initialized: true,
    })
  })
})
