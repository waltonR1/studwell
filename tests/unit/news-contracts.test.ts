import {expect,it} from 'vitest'
import {emptyNewsContent,newsArticleCreateSchema,newsContentSchema,newsListSectionSchema} from '../../shared/schemas/admin/news'
import {validateNewsPublication,newsMedia} from '../../server/services/news'
import {publicLocalizedQuerySchema, publicNewsParamsSchema} from '../../shared/schemas/public/queries'
import {matchesAdminPath} from '../../server/policies/admin-route'
it('草稿允许未完成文字，但发布要求完整五语言，媒体只接受实体编号',()=>{
 const content=emptyNewsContent('2026110521000000001');expect(newsContentSchema.safeParse(content).success).toBe(true);expect(()=>validateNewsPublication(content)).toThrow()
 content.coverMediaId='/api/news/example.webp';expect(newsContentSchema.safeParse(content).success).toBe(false)
 expect(newsArticleCreateSchema.safeParse({slug:'../test',content}).success).toBe(false)
})
it('新闻详情只接受单个 locale 和合法 slug',()=>{
 expect(publicLocalizedQuerySchema.parse({})).toEqual({})
 for(const query of [{page:'1'},{featured:'true'},{locale:['en','zh']},{draft:'true'}])expect(publicLocalizedQuerySchema.safeParse(query).success).toBe(false)
 expect(publicNewsParamsSchema.safeParse({slug:'../test'}).success).toBe(false)
})
it('列表展示设置要求有效整数分页和真正的布尔值',()=>{
 const section={copy:{all:'全部',empty:'暂无新闻'},data:{pageSize:12,showFilters:true,showDate:true,showSummary:true}}
 expect(newsListSectionSchema.safeParse(section).success).toBe(true)
 expect(newsListSectionSchema.safeParse({...section,data:{...section.data,pageSize:0}}).success).toBe(false)
 expect(newsListSectionSchema.safeParse({...section,data:{...section.data,showFilters:'true'}}).success).toBe(false)
})
it('图片引用覆盖封面和所有语言正文，历史路由只接受数字编号',()=>{
 const c=emptyNewsContent('2026110521000000001');c.coverMediaId='2026110514000000001';c.localized.en.body=[{type:'image',image:{mediaId:'2026110514000000002',alt:'图片'},caption:''}]
 expect(newsMedia(c).map(r=>String(r.mediaId))).toEqual(['2026110514000000001','2026110514000000002'])
 const pattern='/api/admin/news/articles/:id/releases/:releaseId';expect(matchesAdminPath(pattern,'/api/admin/news/articles/2026110522000000001/releases/2026110523000000001')).toBe(true);expect(matchesAdminPath(pattern,'/api/admin/news/articles/1/releases/../../x')).toBe(false)
})
