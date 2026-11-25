import {readFileSync,existsSync} from 'node:fs'
import {describe,it,expect} from 'vitest'
import {sectionTemplateRevisionSchema} from '../../shared/schemas/admin/section-template'
import {assertTemplateConfiguration} from '../../server/policies/template-configuration'
import templates from '../../scripts/database/seed/data/templates.json'
import modulePolicy from '../../scripts/database/seed/data/module-policy.json'
const policy=modulePolicy.templates
import renderers from '../../scripts/database/seed/data/renderers.json'
import {websiteTemplateCatalog} from '../../scripts/database/seed/site'
import {resolveSectionForm} from '../../app/utils/admin/website/section-form-definition'

describe('API 驱动的特殊 Section 是可选框架能力',()=>{
 it.each(['news.list','news.article','home.news','careers.positionsSection','contact.detailsSection'])('%s 保留合同、编辑器和已部署组件',key=>{
  const definition=sectionTemplateRevisionSchema.parse(templates.find(t=>t.key===key))
  expect(()=>assertTemplateConfiguration(definition)).not.toThrow()
  expect(resolveSectionForm(definition).groups.length).toBeGreaterThan(0)
  expect(websiteTemplateCatalog.some(t=>t.key===key)).toBe(true)
  expect(definition.allowedPages).toBe('all')
  for(const scope of ['public','preview']){
   const renderer=renderers.find(r=>r.key===key&&r.scope===scope)
   expect(renderer).toBeDefined()
   expect(existsSync(renderer!.componentPath)).toBe(true)
  }
 })
 it('能力映射保留业务依赖，站点关闭不删除能力',()=>{
  expect(policy['news.list'].provides).toContain('news.list')
  expect(policy['news.article'].provides).toContain('news.article')
  expect(policy['home.news'].requires).toContain('news.list')
  expect(policy['careers.positionsSection'].provides).toContain('careers.positions')
  expect(policy['contact.detailsSection'].provides).toContain('inquiries.form')
 })
 it('前端适配继续调用新闻、招聘和询盘 API',()=>{
  for(const [file,symbol] of [
   ['app/composables/public/sections/news/useNewsDetail.ts','usePublicNewsDetailApi'],
   ['app/composables/public/sections/careers/useCareerPositions.ts','usePublicCareerPositionsApi'],
   ['app/composables/public/sections/contact/useInquiryForm.ts','submitPublicInquiryApi'],
  ])expect(readFileSync(file!,'utf8')).toContain(symbol)
 })
 it('详情路由和后台预览保留业务上下文',()=>{
  expect(readFileSync('app/pages/[...segments].vue','utf8')).toContain('detailTemplates')
  expect(readFileSync('app/composables/public/sections/pageExtensions.ts','utf8')).toContain('newsRoute')
  expect(readFileSync('app/composables/admin/preview/providePreviewData.ts','utf8')).toContain('provideNewsPreview')
  expect(readFileSync('app/pages/index.vue','utf8')).toContain('ContentPage')
 })
})
