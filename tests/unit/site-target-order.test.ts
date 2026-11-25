import {expect,it} from 'vitest'
import {orderedSiteTargets} from '../../app/utils/admin/site-settings/targets'
import type {SiteTarget} from '../../shared/types/admin/site-settings'
import {emptySiteText} from '../../shared/utils/admin/site-settings'
it('页面后紧跟所属目标且不改变原目录',()=>{
 const item=(module:string,type:'page'|'anchor',value=''):SiteTarget=>({key:`${type}:${module}:${value}`,path:type==='page'?'/'+module:'/about/'+value,resourceId:String(module.length),target:{module,resourceId:String(module.length),type,value},label:emptySiteText(),})
 const source=[item('home','page'),item('about','page'),item('contact','page'),item('about','anchor','profile'),item('about','anchor','history')]
 const before=structuredClone(source)
 expect(orderedSiteTargets(source).map(item=>item.key)).toEqual(['page:home:','page:about:','anchor:about:profile','anchor:about:history','page:contact:'])
 expect(source).toEqual(before)
})
