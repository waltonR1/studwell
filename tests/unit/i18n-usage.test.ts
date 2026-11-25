import {afterEach,expect,it} from 'vitest'
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname,join,resolve} from 'node:path'
import {auditI18n} from '../../scripts/check-i18n.mjs'

const fixtures:string[]=[]
function fixture(messages:object,source:string){
 const root=mkdtempSync(join(tmpdir(),'studwell-i18n-'));fixtures.push(root)
 mkdirSync(join(root,'app/components/public/example'),{recursive:true})
 mkdirSync(join(root,'i18n/locales'),{recursive:true})
 writeFileSync(join(root,'app/components/public/example/ExampleSection.vue'),source)
 for(const locale of ['en','fr','es','pt','zh'])writeFileSync(join(root,'i18n/locales',locale+'.json'),JSON.stringify(messages))
 return root
}
afterEach(()=>{for(const root of fixtures.splice(0)){expect(dirname(root)).toBe(resolve(tmpdir()));rmSync(root,{recursive:true})}})

it('API 文案不要求本地词条，插值中的 UI 翻译仍需检查',()=>{
 const root=fixture({common:{close:'Close'}},`<template>{{ contentText('api.title', {button: t('common.close')}) }}</template>`)
 const result=auditI18n(root)
 expect(result.errors).toEqual([])
 expect([...result.used.keys()]).toEqual(['common.close'])
 expect(result.unused).toEqual([])
})

it('五语言、动态调用、SEO 和字段引用均可解析，备用词条有完整清单',()=>{
 const result=auditI18n()
 expect(result.errors).toEqual([])
 expect(result.unresolved).toEqual([])
 expect(new Set([...result.used,...result.unused]).size).toBe(result.keys)
 expect(result.used.size+result.unused.length).toBe(result.keys)
})

it('按嵌套循环的真实条目解析动态 key，不用前缀通配保留同组废弃字段',()=>{
 const root=fixture({section:{first:{title:'First'},second:{title:'Second'},unused:'Unused'}},`
 <script setup lang="ts">const groups=[{items:['first','second']}] as const</script>
 <template><div v-for="group in groups"><p v-for="item in group.items">{{ t(\`section.\${item}.title\`) }}</p></div><!-- t('section.unused') --></template>`)
 const result=auditI18n(root)
 expect([...result.used.keys()]).toEqual(['section.first.title','section.second.title'])
 expect(result.unused).toEqual(['section.unused'])
 expect(result.unresolved).toEqual([])
})

it('缺失的动态词条和无法解析的动态调用分别报错，不能静默跳过',()=>{
 const root=fixture({section:{first:'First'}},`
 <script setup lang="ts">const items=['first','missing']</script>
 <template><p v-for="item in items">{{ t(\`section.\${item}\`) }}</p>{{ t(arbitraryKey) }}</template>`)
 const result=auditI18n(root)
 expect(result.errors).toEqual([expect.stringContaining('missing key section.missing')])
 expect(result.unresolved).toEqual([expect.stringContaining('arbitraryKey')])
})

it('核对五语言键集合和插值参数，并检查 SEO 使用的键',()=>{
 const root=fixture({seo:{title:'Title {count}'}},`<script setup lang="ts">usePageSeo('seo.title','seo.missing')</script><template><div/></template>`)
 writeFileSync(join(root,'i18n/locales/fr.json'),JSON.stringify({seo:{title:'Titre {total}'},extra:'Extra'}))
 const result=auditI18n(root)
 expect(result.errors).toEqual(expect.arrayContaining([
  expect.stringContaining('missing key seo.missing'),
  'fr: interpolation differs at seo.title',
  'fr: key structure differs at extra',
 ]))
})

it('静态展开的类别列表仍检查每一个动态翻译键',()=>{
 const root=fixture({types:{all:'All',first:'First',second:'Second'}},`<script setup lang="ts">const categories=[{type:'first'},{type:'second'}] as const;const filters=['all',...categories.map(item=>item.type)] as const</script><template><p v-for="item in filters">{{ t(\`types.\${item}\`) }}</p></template>`)
 const result=auditI18n(root)
 expect(result.unresolved).toEqual([])
 expect(result.errors).toEqual([])
 expect(result.unused).toEqual([])
})
