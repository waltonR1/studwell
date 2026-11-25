import {readFileSync} from 'node:fs'
import {parse,compileScript} from '@vue/compiler-sfc'
import {transformSync} from 'esbuild'
import * as vue from 'vue'
import * as ssr from 'vue/server-renderer'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import * as context from '../../app/composables/public/runtime/usePublicPage'
import type {PublicSection} from '../../shared/types/public/website'
import {websiteTemplateCatalog} from '../../scripts/database/seed/site'
import renderers from '../../scripts/database/seed/data/renderers.json'

const state=vi.hoisted(()=>({snapshot:undefined as unknown}))
vi.mock('../../app/composables/public/runtime/usePageContent',()=>({usePageContent:()=>({snapshot:state.snapshot,ready:Promise.resolve()})}))
beforeEach(()=>{
 for(const name of ['computed','provide','inject','toValue','ref','watch'] as const)vi.stubGlobal(name,vue[name])
 vi.stubGlobal('useRoute',()=>({fullPath:'/guide',hash:''}))
})
afterEach(()=>vi.unstubAllGlobals())

// 编译实际展示组件，验证不传 content prop 时仍由当前区块上下文正确渲染。
function component(path:string){
 const {descriptor}=parse(readFileSync(path,'utf8'),{filename:path})
 const script=compileScript(descriptor,{id:'section-context-test',inlineTemplate:true,templateOptions:{ssr:true}})
 const code=transformSync(script.content,{loader:'ts',format:'cjs'}).code
 const module={exports:{} as {default:vue.Component}}
 const require=(name:string)=>{
  if(name==='vue')return vue
  if(name==='vue/server-renderer')return ssr
  if(name==='~/composables/public/runtime/usePublicPage')return context
  throw new Error('Unexpected component dependency: '+name)
 }
 new Function('require','module','exports','computed',code)(require,module,module.exports,vue.computed)
 return module.exports.default
}
async function render(Component:vue.Component,sections:PublicSection[],ids=sections.map(s=>s.id)){
 state.snapshot=vue.ref({page:{key:'guide',locale:'zh',releaseId:'sample',sections,media:{}},structure:{key:'guide',sections}})
 const Section=vue.defineComponent({props:{id:{type:String,required:true}},setup(props){context.providePublicSection(()=>props.id);return()=>vue.h(Component)}})
 return ssr.renderToString(vue.createSSRApp(vue.defineComponent({setup(){context.usePublicPage('guide');return()=>vue.h('article',ids.map(id=>vue.h(Section,{id})))}})))
}
function section(id:string,content:PublicSection['content']):PublicSection{
 return {id,templateKey:'guide.document',renderer:'',sortOrder:0,anchorKey:id,shared:{media:[]},content}
}

it('指南组件无需 content prop，相同模板的两个实例各自读取文案和代码',async()=>{
 const Document=component('app/components/public/sections/guide/DocumentSection.vue')
 const html=await render(Document,[section('a',{title:'第一篇',body:'第一段\n第二段',code:'<sample>'}),section('b',{title:'第二篇',body:'独立正文',code:''})])
 expect(html).toMatch(/<h2\b[^>]*>第一篇<\/h2>/)
 expect(html).toMatch(/<p\b[^>]*>第一段<\/p><p\b[^>]*>第二段<\/p>/)
 expect(html).toContain('&lt;sample&gt;')
 expect(html).toMatch(/<h2\b[^>]*>第二篇<\/h2>/)
 expect(html).toMatch(/<p\b[^>]*>独立正文<\/p>/)
 expect(html.match(/<pre\b/g)).toHaveLength(1)
})
it('普通正文展示从当前预览区块上下文读取文案',async()=>{
 const Text=component('app/components/public/sections/common/TextContent/Desktop.vue')
 const html=await render(Text,[section('text',{copy:{title:'正文预览',body:'草稿中的正文'}})])
 expect(html).toContain('正文预览')
 expect(html).toContain('草稿中的正文')
})
it('导语只展示标题和概览，不再内置目录',async()=>{
 const Intro=component('app/components/public/sections/guide/IntroductionSection.vue')
 const html=await render(Intro,[section('intro',{heading:'正常装配标题',summary:'普通 Section',eyebrow:'Studwell',facts:[{value:'7',label:'页面'}]}),section('chapter',{title:'正文目录',body:'内容'})],['intro'])
 expect(html).toMatch(/<h1\b[^>]*>正常装配标题<\/h1>/)
 expect(html).not.toContain('href="#chapter"')
 expect(html).not.toContain('正文目录')
 for(const path of ['app/pages/index.vue','app/pages/[...segments].vue'])expect(readFileSync(path,'utf8')).not.toMatch(/GuidePage|isGuide|guide\.document/)
})
it('正文合同及公开、预览映射成套提供，与原站使用同一后台包装入口',()=>{
 expect(websiteTemplateCatalog.find(t=>t.key==='content.text')?.preview.pageKey).toBe('guide')
 const entries=renderers.filter(r=>r.key==='content.text')
 expect(entries.map(r=>r.scope).sort()).toEqual(['preview','public'])
 expect(entries.find(r=>r.scope==='public')?.componentPath).toBe('app/components/public/sections/common/TextContent.vue')
 expect(entries.find(r=>r.scope==='preview')?.componentPath).toBe('app/components/admin/preview/templates/TextContent.vue')
 expect(readFileSync('app/components/admin/preview/templates/TextContent.vue','utf8')).toContain("import PublicTextContent from '~/components/public/sections/common/TextContent.vue'")
})

it('页内目录从同页正文标题生成锚点，排除自身和无标题区块',async()=>{
 const Sidebar=component('app/components/public/sections/common/SidebarNavigation.vue')
 const html=await render(Sidebar,[section('navigation',{copy:{title:'本页内容'}}),section('chapter',{title:'章节标题',body:'正文'}),section('copy-title',{copy:{title:'另一个章节'}}),section('empty',{body:'无标题'}),section('intro',{heading:'页面大标题'})],['navigation'])
 expect(html).toContain('href="#chapter"')
 expect(html).toContain('href="#copy-title"')
 expect(html).toContain('章节标题')
 expect(html).not.toContain('href="#navigation"')
 expect(html).not.toContain('href="#empty"')
 expect(html).not.toContain('href="#intro"')
 expect(html).not.toContain('/installation')
})
