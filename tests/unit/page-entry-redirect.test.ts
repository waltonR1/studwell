import {expect,it} from 'vitest'
import {pageEntryRedirect} from '../../app/utils/public/sections/common/pageEntryBehavior'
const section={id:'1',templateKey:'custom.entry',capabilities:['page.redirect'],anchorKey:'entry',sortOrder:0}
const pages={about:{key:'about',path:'/about',sections:[section]},profile:{key:'profile',path:'/about/profile',sections:[]},other:{key:'other',path:'/other',sections:[section]}}
it('页面入口使用已解析路径跳转到正文页，不再按页面 ID 查找',()=>{
 expect(pageEntryRedirect('/about/profile','about',pages)).toEqual({external:false,to:{path:'/about/profile',query:{},hash:''}})
})
it('保留目标查询参数和锚点，包括重复参数',()=>{
 expect(pageEntryRedirect('/about/profile?source=nav&tag=a&tag=b#history','about',pages)).toEqual({external:false,to:{path:'/about/profile',query:{source:'nav',tag:['a','b']},hash:'#history'}})
})
it('拒绝自跳转、入口页之间循环、未知站内地址和非法协议',()=>{
 for(const path of ['/about','/other','/missing','//example.com','javascript:alert(1)'])expect(pageEntryRedirect(path,'about',pages)).toBeUndefined()
 expect(pageEntryRedirect(undefined,'about',pages)).toBeUndefined()
})
it('外部目标使用配置的完整地址',()=>{
 expect(pageEntryRedirect('https://example.com/company?source=nav#about','about',pages)).toEqual({external:true,to:'https://example.com/company?source=nav#about'})
})

it('入口行为按能力触发，不要求固定模板代称',async()=>{
 const {resolvePageBehavior}=await import('../../app/utils/public/runtime/pageBehaviors')
 const {entryBehavior}=await import('../../app/utils/public/sections/common/pageEntryBehavior')
 const custom={...section,renderer:'custom',shared:{media:[]},content:{data:{targetResourceId:'/about/profile'}}}
 expect(resolvePageBehavior([entryBehavior],[custom],'about',pages)).toEqual({external:false,to:{path:'/about/profile',query:{},hash:''}})
 expect(resolvePageBehavior([entryBehavior],[{...custom,capabilities:[]}],'about',pages)).toBeUndefined()
})
