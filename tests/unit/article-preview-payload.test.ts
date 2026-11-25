import {expect, it} from 'vitest'
import {articlePreviewPayload} from '../../app/utils/admin/preview/article-payload'
import {emptyNewsContent} from '../../shared/schemas/admin/news'

it('accepts incomplete unsaved articles without requiring a category or complete blocks', () => {
  const content=emptyNewsContent('')
  content.displayDate=''
  content.localized.zh.title='未保存的标题'
  content.localized.zh.body=[
    {type:'paragraph',text:''},
    {type:'image',image:{mediaId:'',alt:'',presentation:{desktop:{x:50,y:50,zoom:1}}},caption:''},
  ]
  const result=articlePreviewPayload.parse({content,locale:'zh'})
  expect(result.content.localized.zh.title).toBe('未保存的标题')
  expect(result.content.localized.zh.body).toHaveLength(2)
  expect(content.categoryId).toBe('')
})

it('preserves the selected language and rejects malformed message contents', () => {
  const content=emptyNewsContent('2026110522000000001')
  content.localized.en.title='Unsaved English title'
  const parsed=articlePreviewPayload.parse({content,locale:'en'})
  expect(parsed.content.localized.en.title).toBe('Unsaved English title')
  expect(parsed.locale).toBe('en')
  expect(articlePreviewPayload.safeParse({content,locale:'invalid'}).success).toBe(false)
  expect(articlePreviewPayload.safeParse({content:null,locale:'en'}).success).toBe(false)
  expect(articlePreviewPayload.safeParse({content:{...content,unexpected:true},locale:'en'}).success).toBe(false)
})
