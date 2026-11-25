import { describe, expect, it } from 'vitest'
import { dashboardMetrics } from '../../app/config/admin/dashboard'
import { dashboardMetricPermissions } from '../../server/config/dashboard'
import { dashboardLinks, dashboardMetricLink } from '../../app/utils/admin/dashboard/links'
import type { NavigationItem } from '../../shared/types/admin/menus'
describe('首页可见入口与统计跳转', () => {
  it('展示指标与服务端统计目录一致，且没有重复指标', () => {
    expect(dashboardMetrics.map(item => item.key).sort()).toEqual(Object.keys(dashboardMetricPermissions).sort())
  })
  const navigation: NavigationItem[] = [
    { iconKey: 'folder', id: '1', parentId: null, code: 'system', name: '系统管理', path: null },
    { iconKey: 'folder', id: '2', parentId: '1', code: 'custom_users', name: '自定义账号入口', path: '/admin/users' },
    { iconKey: 'folder', id: '3', parentId: '1', code: 'duplicate_users', name: '重复入口', path: '/admin/users' },
    { iconKey: 'folder', id: '4', parentId: '1', code: 'login_logs', name: '登录日志', path: '/admin/logs/login' },
  ]
  it('只从服务端可见投影取页面，保留名称/顺序并去重，不凭权限补隐藏菜单', () => {
    expect(dashboardLinks(navigation)).toEqual([{ id: '2', name: '自定义账号入口', path: '/admin/users' }, { id: '4', name: '登录日志', path: '/admin/logs/login' }])
    expect(dashboardLinks([])).toEqual([])
    expect(dashboardMetricLink(dashboardMetrics.find(item => item.key === 'roles')!, navigation)).toBeUndefined()
    expect(dashboardMetricLink(dashboardMetrics.find(item => item.key === 'users')!, [])).toBeUndefined()
  })
  it('统计跳转遵循真实查询口径，成功/失败只查今日login，不混入logout', () => {
    expect(dashboardMetricLink(dashboardMetrics.find(item => item.key === 'loginSuccess')!, navigation)).toEqual({ path: '/admin/logs/login', query: { period: 'today', action: 'login', result: 'success' } })
    expect(dashboardMetricLink(dashboardMetrics.find(item => item.key === 'loginFailed')!, navigation)).toEqual({ path: '/admin/logs/login', query: { period: 'today', action: 'login', result: 'failed' } })
  })
})
