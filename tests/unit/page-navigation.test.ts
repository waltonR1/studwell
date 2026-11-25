import {expect,it} from 'vitest'
import {pageNavigation} from '../../app/utils/public/sections/common/pageNavigation'
const links=[{resourceId:'/company',label:'Overview'},{resourceId:'/company#team',label:'Team'},{resourceId:'/company?tab=history',label:'History'},{resourceId:'https://example.com',label:'External'}]
it('锚点和查询目标保留高亮，精确目标优先于普通页面入口',()=>{
 expect(pageNavigation(links,{path:'/company',query:{},hash:'#team'}).filter(link=>link.active).map(link=>link.label)).toEqual(['Team'])
 expect(pageNavigation(links,{path:'/company',query:{tab:'history'},hash:''}).filter(link=>link.active).map(link=>link.label)).toEqual(['History'])
 expect(pageNavigation(links,{path:'/company',query:{},hash:''}).filter(link=>link.active).map(link=>link.label)).toEqual(['Overview'])
})
it('重复地址仍具有独立键，外链不参与当前项选择',()=>{
 const result=pageNavigation([...links,links[0]!],{path:'/company',query:{},hash:''})
 expect(new Set(result.map(link=>link.key)).size).toBe(result.length)
 expect(result.filter(link=>link.active)).toHaveLength(1)
 expect(result.find(link=>link.label==='External')?.active).toBe(false)
})
it('比较重复查询参数并排除无效协议',()=>{
 const input=[{resourceId:'/company?tag=a&tag=b',label:'Tags'},{resourceId:'javascript:alert(1)',label:'Invalid'}]
 expect(pageNavigation(input,{path:'/company',query:{tag:['a','b']},hash:''}).map(link=>[link.label,link.active])).toEqual([['Tags',true]])
 expect(pageNavigation(input,{path:'/company',query:{tag:['b','a']},hash:''})[0]?.active).toBe(false)
})
