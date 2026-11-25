import {expect, it} from 'vitest'
import {matchWebsiteRoute, parseWebsiteRoutePattern, websiteRoutePatternIdentity} from '../../shared/utils/website/route-pattern'

it('matches article URLs to one detail layout and prefers an exact route', () => {
  const detail = {path: '/news/:slug', page: 'news_detail'}
  const archive = {path: '/news/archive', page: 'archive'}
  const routes = [detail, archive]
  expect(matchWebsiteRoute(routes, '/news/archive')).toEqual({route: archive, params: {}})
  expect(matchWebsiteRoute(routes, '/news/company-update')).toEqual({route: detail, params: {slug: 'company-update'}})
  expect(matchWebsiteRoute(routes, '/news/other')).toEqual({route: detail, params: {slug: 'other'}})
  for (const path of ['/news', '/news/:slug', '/news/a/b', '/news/a%2fb']) expect(matchWebsiteRoute(routes, path)).toBeUndefined()
})

it('validates depth, reserved prefixes, terminal parameters and route collisions', () => {
  expect(parseWebsiteRoutePattern('/a/b/c/d/e/:slug')).not.toBeNull()
  for (const path of ['/:slug', '/search/:slug', '/news/:slug/archive', '/a/b/c/d/e/f/:slug']) expect(parseWebsiteRoutePattern(path)).toBeNull()
  expect(websiteRoutePatternIdentity('/news/:slug')).toBe(websiteRoutePatternIdentity('/news/:article'))
  expect(websiteRoutePatternIdentity('/news/archive')).not.toBe(websiteRoutePatternIdentity('/news/:slug'))
})
