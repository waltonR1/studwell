import {existsSync,readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {describe,expect,it} from 'vitest'

it('展现组件和解析器不反向读取站点装配配置，公开路由经过 API 层',()=>{
 for(const file of [
  'app/components/public/runtime/layout/CorporateShell.vue',
  'app/components/public/runtime/routes/ContentPage.vue',
  'app/utils/public/runtime/pageBehaviors.ts',
  'app/utils/public/runtime/routeTemplates.ts',
 ]){
  expect(readFileSync(resolve(file),'utf8'),file).not.toMatch(/~\/config\/public\//)
 }
 const route=readFileSync(resolve('app/pages/[...segments].vue'),'utf8')
 expect(route).toContain('usePublicWebsiteRouteApi')
 expect(route).not.toMatch(/\buseFetch\b|\$fetch/)
})

describe('官网新闻组件边界',()=>{
 it('新闻扩展通过 composable 接入，并使用通用页面装配',()=>{
  expect(existsSync(resolve('app/components/public/runtime/routes/NewsDetail.vue'))).toBe(false)
  const file=resolve('app/composables/public/sections/news/detailRoute.ts')
  const source=readFileSync(file,'utf8')
  expect(source).not.toMatch(/\$fetch|useFetch|from\s+['"]~\/api\//)
  expect(source).toContain('useNewsDetail')
  expect(readFileSync(resolve('app/components/public/runtime/routes/ContentPage.vue'),'utf8')).not.toMatch(/news|useNewsDetail/i)
 })
 it('新闻展示类型直接使用共享 DTO，不保留兼容转发文件',()=>{
  expect(existsSync(resolve('app/types/public/news.ts'))).toBe(false)
  for(const file of [
   'app/components/public/sections/news/shared/NewsCard.vue',
   'app/components/public/sections/news/shared/NewsImage.vue',
  ]){
   const source=readFileSync(resolve(file),'utf8')
   expect(source).toContain('#shared/types/public/news')
   expect(source).not.toContain('~/types/public/news')
  }
 })
})
