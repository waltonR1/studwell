import {beforeEach,expect,it,vi} from 'vitest'
import {reactive} from 'vue'
import {createPinia,setActivePinia} from 'pinia'
import {careerContentSchema,careerLocales,type AdminCareerPosition} from '../../shared/schemas/admin/careers'

const mocks=vi.hoisted(()=>({
  read:vi.fn(),
  mutate:vi.fn(),
  session:{generation:0,can:(permission:string)=>!!permission},
}))

vi.mock('~/stores/admin/request',()=>({
  useAdminRequestStore:()=>({
    read:mocks.read,
    mutate:mocks.mutate,
    message:()=> '加载失败',
    operationMessage:()=> '操作失败',
  }),
}))
vi.mock('~/stores/admin/session',()=>({useAdminSessionStore:()=>mocks.session}))

import {useAdminCareersStore} from '../../app/stores/admin/careers'

const position=():AdminCareerPosition=>({
  id:'2026111017000000001',
  version:2,
  publishedReleaseId:'2026111017000000002',
  changed:true,
  content:careerContentSchema.parse({
    sortOrder:10,
    localized:Object.fromEntries(careerLocales.map(locale=>[locale,{
      title:'海外市场专员',
      department:'海外事业部',
      location:'杭州',
      responsibilities:['职责'],
      requirements:['要求'],
    }])),
  }),
})

beforeEach(()=>{
  setActivePinia(createPinia())
  mocks.read.mockReset()
  mocks.mutate.mockReset()
  mocks.session=reactive({generation:0,can:(permission:string)=>!!permission})
})

it('保存草稿失败保留表单错误，不返回 Toast',async()=>{
  const store=useAdminCareersStore(),row=position()
  store.edit(row)
  mocks.mutate.mockRejectedValue(new Error('conflict'))
  expect(await store.save()).toBeNull()
  expect(store.saveError).toBe('操作失败')
  expect(store.draft?.content.localized.zh.title).toBe('海外市场专员')
})

it('发布等行操作失败返回 Error Toast，不写入表单错误',async()=>{
  const store=useAdminCareersStore()
  mocks.mutate.mockRejectedValue(new Error('conflict'))
  expect(await store.changeState(position(),'publish')).toEqual({message:'操作失败',status:'error'})
  expect(store.saveError).toBe('')
})
