import {readFileSync,readdirSync} from 'node:fs'
import {dirname,resolve} from 'node:path'
import {describe,expect,it} from 'vitest'

const root=resolve('app/components/admin/website')
function files(area:string):string[]{return readdirSync(resolve(root,area),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(area+'/'+entry.name):entry.name.endsWith('.vue')?[resolve(root,area,entry.name)]:[])}
const normalize=(value:string)=>value.replaceAll('\\','/')
function dependencies(file:string){
 const source=readFileSync(file,'utf8')
 const imports=[...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(([,specifier])=>normalize(specifier!.startsWith('~/')?resolve('app',specifier!.slice(2)):resolve(dirname(file),specifier!)))
 return {source,imports}
}

describe('网站维护组件职责边界',()=>{
 it.each([['pages','site','site-settings'],['site','pages','website-pages']])('%s 不依赖 %s 的组件或业务状态',(area,other,store)=>{
  const violations=files(area!).flatMap(file=>{
   const {source,imports}=dependencies(file)
   return imports.filter(target=>target.startsWith(normalize(resolve(root,other!))+'/')||target.endsWith('/stores/admin/'+store))
    .concat(source.includes(`<AdminWebsite${other==='pages'?'Pages':'Site'}`)?['另一领域的自动注册组件']:[])
    .map(target=>`${normalize(file)} -> ${target}`)
  })
  expect(violations).toEqual([])
 })
 it('领域共用组件不反向依赖页面、公共配置或模板编辑状态',()=>{
  const violations=files('shared').flatMap(file=>{
   const {source,imports}=dependencies(file)
   return imports.filter(target=>/\/website\/(pages|site)\//.test(target)||/\/stores\/admin\/(website-pages|site-settings|website-templates)$/.test(target))
    .concat(/<AdminWebsite(Pages|Site)/.test(source)?['领域业务组件']:[])
    .map(target=>`${normalize(file)} -> ${target}`)
  })
  expect(violations).toEqual([])
 })
 it('网站维护组件不直接读取通用请求或传输层',()=>{
  const violations=files('.').flatMap(file=>{
   const {source,imports}=dependencies(file)
   return imports.filter(target=>target.endsWith('/stores/admin/request'))
    .concat(/\$fetch|useFetch|useAdminRequestStore/.test(source)?['组件内直接请求']:[])
    .map(target=>`${normalize(file)} -> ${target}`)
  })
  expect(violations).toEqual([])
 })
})

describe('网站维护 Store 通知合同',()=>{
 it('业务 Store 返回操作结果，不依赖 Toast 展示类型',()=>{
  for(const file of ['website-pages','site-settings','website-templates']){
   const source=readFileSync(resolve('app/stores/admin',file+'.ts'),'utf8')
   expect(source).not.toContain('AdminToastNotification')
   expect(source).toContain('AdminActionResult')
  }
 })
})
