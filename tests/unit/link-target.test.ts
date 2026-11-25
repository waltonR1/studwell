import {sectionContentSchema} from '../../shared/schemas/website/section-content'
import {describe,expect,it} from 'vitest'
import {linkTargetSchema} from '../../shared/schemas/website/link-target'
import {resolveLinkTarget,sameLinkTarget} from '../../shared/utils/website/link-target'
import {templateDefinition} from '../fixtures/reference/template-catalog'

import {publishedNavigationLinks} from '../../server/policies/website-navigation'
import {siteLink} from '../../app/utils/public/runtime/siteLink'
import type {PublicSiteSettings} from '../../shared/types/public/website'
const page={type:'page' as const,module:'about',resourceId:'123',value:''}
const anchor={...page,type:'anchor' as const,value:'history'}
describe('最新跳转目标合同',()=>{
 it('只接收结构化目标，拒绝旧路径、裸 ID、导航键和缺少页面 ID 的对象',()=>{
  for(const value of ['/company','123','page:about:',{type:'page',module:'about',value:''}])expect(linkTargetSchema.safeParse(value).success).toBe(false)
  expect(linkTargetSchema.safeParse(page).success).toBe(true)
  const field={kind:'link' as const,label:'跳转目标'}
  expect(sectionContentSchema(field).safeParse('/company').success).toBe(false)
  expect(sectionContentSchema(field).safeParse(page).success).toBe(true)
  expect(sectionContentSchema(field).safeParse(null).success).toBe(true)
 })
 it('只按页面 ID 解析当前地址，目标不存在时不回退到同名页面',()=>{
  const pages=[{resourceId:'123',key:'renamed',path:'/new-company',linkLocations:{'news-category':{queryKey:'category',anchorKey:'latest-news'}}},{resourceId:'999',key:'about',path:'/wrong'}]
  expect(resolveLinkTarget(page,pages)).toBe('/new-company')
  expect(resolveLinkTarget(anchor,pages)).toBe('/new-company#history')
  expect(resolveLinkTarget(page,[pages[1]!])).toBe('')
  expect(resolveLinkTarget({...page,type:'news-category',value:'industry'},pages)).toBe('/new-company?category=industry#latest-news')
  const settings={pages:{renamed:pages[0],about:pages[1]}} as unknown as PublicSiteSettings
  expect(siteLink(page,settings)).toEqual({path:'/new-company'})
  expect(sameLinkTarget(page,{...page,resourceId:'999'})).toBe(false)
 })
 it('自定义地址按原值使用，不查询历史路径',()=>{
  expect(resolveLinkTarget({type:'custom',value:'/old-path'},[{resourceId:'123',path:'/new-path'}])).toBe('/old-path')
  expect(resolveLinkTarget(null,[])).toBe('')
 })
 it('卡片合同只保留一个结构化目标，不再接收独立外链字段',()=>{
  const fields=templateDefinition('content.links')!.fields.fields!.data!.fields!.cards!.item!
  const card={id:'example',name:'示例',summary:'摘要',status:'',image:{mediaId:null},resourceId:page}
  expect(sectionContentSchema(fields).safeParse(card).success).toBe(true)
  expect(sectionContentSchema(fields).safeParse({...card,url:'https://example.com'}).success).toBe(false)
  expect(sectionContentSchema(fields).safeParse({...card,resourceId:'123'}).success).toBe(false)
 })
 it('收集可见区块里的结构化引用，排除隐藏内容和自定义链接',()=>{
  const content={sections:[{visible:true,localized:{zh:{data:{cards:[{resourceId:page}]}}}},{visible:false,localized:{zh:{to:anchor}}}],contactTarget:{type:'custom',value:'https://example.com'}}
  expect(publishedNavigationLinks(content).map(link=>link.target)).toEqual([page])
 })
 it('拒绝脚本、协议相对地址和非法目标标识',()=>{
  for(const value of ['javascript:alert(1)','//example.com','/\\example.com',''])expect(linkTargetSchema.safeParse({type:'custom',value}).success).toBe(false)
  expect(linkTargetSchema.safeParse({...page,resourceId:'invalid'}).success).toBe(false)
  expect(linkTargetSchema.safeParse({...page,value:'unexpected'}).success).toBe(false)
 })
})

it('业务链接按投影的定位配置解析，不在通用层登记业务名称',()=>{
 expect(resolveLinkTarget({type:'topic-filter',resourceId:'1',module:'custom',value:'featured'},[{resourceId:'1',path:'/resources',linkLocations:{'topic-filter':{queryKey:'topic',anchorKey:'resource-grid'}}}])).toBe('/resources?topic=featured#resource-grid')
})
