import {createSSRApp,defineComponent,h,ref} from 'vue'
import {renderToString} from 'vue/server-renderer'
import {expect,it,vi} from 'vitest'
import {providePreviewData} from '../../app/composables/admin/preview/providePreviewData'
import {useHomeNews} from '../../app/composables/public/sections/news/useHomeNews'
import {useNewsCatalog} from '../../app/composables/public/sections/news/useNewsCatalog'
import {useCareerPositions} from '../../app/composables/public/sections/careers/useCareerPositions'
import {useInquiryForm} from '../../app/composables/public/sections/contact/useInquiryForm'
import {useNewsArticle} from '../../app/composables/public/sections/news/articleContext'
import {previewArticle} from '../fixtures/previewArticle'
import type {WebsitePreviewData} from '../../shared/types/admin/website-preview'

const {request}=vi.hoisted(()=>({request:vi.fn(()=>{throw new Error('Preview must not call public APIs')})}))
vi.mock('../../app/api/public/http',()=>({usePublicApiFetch:request}))

it('页面与文章预览的数据适配器隔离真实业务请求，并随文章草稿更新',async()=>{
 const source=ref<WebsitePreviewData>({article:previewArticle,positions:[{id:'sample',title:'样例岗位',department:'研发',location:'上海',responsibilities:[],requirements:[]}],inquiryCategories:[]})
 let check:()=>Promise<void>=async()=>{throw new Error('Preview child did not render')}
 const child=defineComponent({async setup(){
  const article=useNewsArticle()
  const [home,catalog,careers,inquiry]=await Promise.all([useHomeNews(),useNewsCatalog(12),useCareerPositions(),useInquiryForm()])
  check=async()=>{
   expect(home.featured.value?.title).toBe('更新后的草稿')
   expect(catalog.list.value?.items[0]?.title).toBe('更新后的草稿')
   expect(article?.value?.title).toBe('更新后的草稿')
   expect(careers.positions.value[0]?.title).toBe('更新后的岗位')
   expect(inquiry.categories.value[0]?.label).toBe('更新后的咨询分类')
   inquiry.fields.email='preview@example.com'
   inquiry.fields.message='This must not be submitted'
   await inquiry.submit()
   expect(request).not.toHaveBeenCalled()
  }
  return ()=>h('p',home.featured.value?.title)
 }})
 const app=createSSRApp(defineComponent({setup(){providePreviewData(()=>source.value);return ()=>h(child)}}))
 expect(await renderToString(app)).toContain(previewArticle.title)
 source.value={...source.value,article:{...previewArticle,title:'更新后的草稿'},positions:[{id:'sample',title:'更新后的岗位',department:'研发',location:'上海',responsibilities:[],requirements:[]}],inquiryCategories:[{code:'sample',label:'更新后的咨询分类'}]}
 await check()
})
