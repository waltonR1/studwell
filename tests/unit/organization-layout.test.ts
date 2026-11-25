import {expect,it} from 'vitest'
import {layoutOrganization,organizationLinkPath} from '../../app/utils/public/sections/about/layout'

type Node={id:string;children?:Node[]}
it('任意标识的根节点使用关系生成层级图，包含全部后代',()=>{
 const root:Node={id:'custom-root',children:[{id:'a',children:[{id:'b',children:[{id:'c',children:[{id:'d'}]}]}]},{id:'empty'},{id:'other',children:[{id:'x'}]}]}
 const points=layoutOrganization(root)
 expect(points.map(point=>point.node.id)).toEqual(['custom-root','a','b','c','d','empty','other','x'])
 expect(points.find(point=>point.node.id==='d')!.depth).toBe(4)
 for(const point of points.filter(point=>point.parentId!==undefined)){
  const parent=points.find(parent=>parent.node.id===point.parentId)!
  expect(point.y).toBeGreaterThan(parent.y)
  expect(organizationLinkPath(parent,point)).not.toMatch(/NaN|undefined/)
 }
 expect(layoutOrganization(root)).toEqual(points)
})
it('空插槽和单节点分支各自占位，同层方框不重叠',()=>{
 const root:Node={id:'root',children:[{id:'empty-a'},{id:'one',children:[{id:'child'}]},{id:'empty-b'}]}
 const branches=layoutOrganization(root).filter(point=>point.depth===1).sort((a,b)=>a.x-b.x)
 for(let i=1;i<branches.length;i++)expect(branches[i]!.x-branches[i-1]!.x).toBeGreaterThan(branches[i]!.radius+branches[i-1]!.radius)
 expect(layoutOrganization({id:'single'})).toHaveLength(1)
 expect(()=>layoutOrganization({id:'root',children:[{id:'a'},{id:'a'}]})).toThrow('Duplicate organization node')
})
