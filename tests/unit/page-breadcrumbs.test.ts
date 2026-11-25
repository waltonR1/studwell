import {expect, it} from 'vitest'
import type {PublicPageStructure, PublicSiteSettings} from '../../shared/types/public/website'
import {pageBreadcrumbs} from '../../app/utils/public/runtime/pageBreadcrumbs'

const page = {resourceId: '12', displayName: '投资市场概况', path: '/investment/market'} as PublicPageStructure
const settings = {
  pages: {market: page},
  header: {items: [{id: 'investment', label: '海外投资', target: {type: 'custom', value: '/investment'}, children: [
    {id: 'market', label: '投资市场概况', target: {type: 'page', resourceId: '12', module: 'market', value: ''}},
  ]}]},
} as PublicSiteSettings

it('按导航父子关系生成首页、一级栏目及当前页，当前页不自链接', () => {
  expect(pageBreadcrumbs(page, settings, '首页', '页面主张')).toEqual([
    {label: '首页', to: '/'},
    {label: '海外投资', to: '/investment'},
    {label: '投资市场概况'},
  ])
})

it('自定义页面路径变更后仍通过资源身份找到一级栏目', () => {
  const renamed = {...page, path: '/projects/overview', displayName: '市场概况'}
  expect(pageBreadcrumbs(renamed, settings, '首页', '页面主张').map(item => item.label))
    .toEqual(['首页', '海外投资', '市场概况'])
})

it('一级栏目落地在第一个子页时保留栏目名称和链接', () => {
  const configured = structuredClone(settings)
  configured.header!.items[0]!.target = {type: 'page', resourceId: '12', module: 'market', value: ''}
  expect(pageBreadcrumbs(page, configured, '首页', '').at(1))
    .toEqual({label: '海外投资', to: '/investment/market'})
})

it('支持后台配置的自定义站内子链接', () => {
  const configured = structuredClone(settings)
  configured.header!.items[0]!.children[0]!.target = {type: 'custom', value: '/investment/market'}
  expect(pageBreadcrumbs(page, configured, '首页', '').map(item => item.label))
    .toEqual(['首页', '海外投资', '投资市场概况'])
})

it('没有父栏目或页面本身就是一级栏目时显示首页和当前页', () => {
  expect(pageBreadcrumbs(page, null, '首页', '')).toEqual([{label: '首页', to: '/'}, {label: '投资市场概况'}])
  expect(pageBreadcrumbs({...page, displayName: '海外投资'}, settings, '首页', ''))
    .toEqual([{label: '首页', to: '/'}, {label: '海外投资'}])
})
