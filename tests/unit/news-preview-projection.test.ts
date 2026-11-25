// 预览转换不修改草稿；媒体授权在转换时显式传入。
import {expect,it} from 'vitest'
import {emptyNewsContent} from '../../shared/schemas/admin/news'
import {projectNewsArticlePreview} from '../../app/utils/admin/preview/news-article'
it('无媒体权限时保留文字并隐藏图片，不修改新闻草稿',()=>{
 const content=emptyNewsContent('sample')
 content.coverMediaId='123'
 content.localized.en={title:'Preview',summary:'Summary',body:[{type:'paragraph',text:'Body'},{type:'image',image:{mediaId:'456',alt:'Image'},caption:'Caption'}],seoTitle:'SEO',seoDescription:'Description',sourceName:'Source',sourceUrl:'https://example.com'}
 const baseline=JSON.stringify(content),media=(id:string)=>'/media/'+id
 const hidden=projectNewsArticlePreview(content,'en',false,undefined,media)
 expect(hidden.coverImage).toBeNull();expect(hidden.body).toEqual([{type:'paragraph',text:'Body'}])
 const visible=projectNewsArticlePreview(content,'en',true,undefined,media)
 expect(visible.coverImage?.src).toBe('/media/123');expect(visible.body[1]).toMatchObject({image:{src:'/media/456',alt:'Image'}})
 expect(visible.seoTitle).toBe('SEO');expect(JSON.stringify(content)).toBe(baseline)
})
