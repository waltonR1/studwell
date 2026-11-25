import {readFileSync} from 'node:fs'
import {parse,compileScript} from '@vue/compiler-sfc'
import {transformSync} from 'esbuild'
import * as vue from 'vue'
import * as ssr from 'vue/server-renderer'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {resolvePageScenes,hasSceneContent} from '../../app/utils/public/runtime/pageScenes'
import {resolvePageBehavior} from '../../app/utils/public/runtime/pageBehaviors'
import {resolveRouteExtension} from '../../app/utils/public/runtime/routeTemplates'

let sceneEnabled=false
let calls:boolean[]=[]
let pageLoads=0
const sections=['first','last'].map(id=>({id,templateKey:id,anchorKey:id,renderer:id,capabilities:[]}))
const snapshot=()=>({page:{locale:'zh',releaseId:'sample'},structure:{sceneEnabled,sections,seo:{title:'Title'} }})
const seo=vi.fn()
beforeEach(()=>{
 sceneEnabled=false;calls=[];pageLoads=0;seo.mockClear()
 for(const name of ['computed','ref','useSlots'] as const)vi.stubGlobal(name,vue[name])
 vi.stubGlobal('useLocalePath',()=>((path:string)=>path))
 vi.stubGlobal('useRoute',()=>({query:{},hash:''}))
})
afterEach(()=>vi.unstubAllGlobals())

// 编译实际页面、区块装配器和场景容器，只替换网络与浏览器生命周期。
function compile(path:string):vue.Component{
 const {descriptor}=parse(readFileSync(path,'utf8'),{filename:path})
 const script=compileScript(descriptor,{id:'assembly-test',inlineTemplate:true,templateOptions:{ssr:true}})
 const code=transformSync(script.content,{loader:'ts',format:'cjs'}).code
 const module={exports:{} as {default:vue.Component}}
 const component=(value:vue.Component)=>({__esModule:true,default:value})
 const require=(name:string):unknown=>{
  if(name==='vue')return vue
  if(name==='vue/server-renderer')return ssr
  if(name.endsWith('/usePublicPage'))return {usePublicPage:()=>{pageLoads++;return {snapshot:vue.computed(snapshot),sections:vue.ref(sections),ready:Promise.resolve()}}}
  if(name.endsWith('/useSiteSettings'))return {useSiteSettings:()=>({settings:vue.ref({pages:{}})})}
  if(name.endsWith('/usePublicSeo'))return {usePublicSeo:seo}
  if(name.endsWith('/pageBehaviors'))return {resolvePageBehavior}
  if(name.endsWith('/routeTemplates'))return {resolveRouteExtension}
  if(name.endsWith('/pageScenes'))return {resolvePageScenes,hasSceneContent}
  if(name.endsWith('/usePageScenes'))return {usePageScenes:(_root:unknown,options:{sceneMode:boolean})=>{calls.push(options.sceneMode);return {ready:vue.ref(options.sceneMode),goToScene:()=>{}}}}
  if(name.endsWith('/sectionRenderer'))return {resolveSectionRenderer:(renderer:string)=>vue.defineComponent({render:()=>vue.h('section',renderer)})}
  if(name.endsWith('/PublishedPageSections.vue'))return component(compile('app/components/public/runtime/rendering/PublishedPageSections.vue'))
  if(name.endsWith('/CorporateFooter.vue'))return component(vue.defineComponent({render:()=>vue.h('footer',{'data-default-footer':''},'default footer')}))
  if(name==='./PageScenes.vue')return component(compile('app/components/public/runtime/rendering/PageScenes.vue'))
  if(name==='./PublishedSection.vue')return component(vue.defineComponent({setup(_,{slots}){return()=>slots.default?.()}}))
  if(name==='./PublishedSectionList.vue')return component(vue.defineComponent({render:()=>vue.h('section',{'data-normal-list':''},'normal')}))
  throw new Error('Unexpected dependency: '+name)
 }
 new Function('require','module','exports',code)(require,module,module.exports)
 return module.exports.default
}
async function render(observeScenes=false,{customFooter=true,staticBody=false}={}){
 const Page=compile('app/components/public/runtime/routes/ContentPage.vue')
 const props=staticBody?{}:{pageKey:'home',detailTemplates:[],sectionBehaviors:[],observeScenes}
 const slots={...(customFooter?{footer:()=>vue.h('footer',{'data-test-footer':''},'footer')} :{}),...(staticBody?{default:()=>vue.h('section','static search body')}:{})}
 return ssr.renderToString(vue.createSSRApp(vue.defineComponent({render:()=>vue.h(Page,props,slots)})))
}

it('普通页面不强制观测，页脚只渲染一次',async()=>{
 const html=await render()
 expect(html).toContain('data-normal-list')
 expect(html).not.toContain('has-scenes')
 expect(calls).toEqual([])
 expect(html.match(/data-test-footer/g)).toHaveLength(1)
 expect(html).not.toContain('data-default-footer')
 expect(seo).toHaveBeenCalledOnce()
})
it.each([false,true])('不传页脚时按开关自动放置默认页脚：sceneEnabled=%s',async enabled=>{
 sceneEnabled=enabled
 const html=await render(false,{customFooter:false})
 expect(html.match(/data-default-footer/g)).toHaveLength(1)
 if(enabled)expect(html.match(/<div\b[^>]*data-page-scene="last"[^>]*>([\s\S]*?)<\/div>/)?.[1]).toContain('data-default-footer')
 else{expect(html).not.toContain('data-page-scene');expect(html.indexOf('data-default-footer')).toBeGreaterThan(html.indexOf('data-normal-list'))}
})
it('搜索等静态页面共用默认页脚，不请求不存在的发布页面或覆盖自身 SEO',async()=>{
 const html=await render(false,{customFooter:false,staticBody:true})
 expect(pageLoads).toBe(0)
 expect(seo).not.toHaveBeenCalled()
 expect(html).toContain('static search body')
 expect(html.match(/data-default-footer/g)).toHaveLength(1)
 expect(html.indexOf('data-default-footer')).toBeGreaterThan(html.indexOf('static search body'))
})
it('关闭整屏时仍可显式观测场景，页脚留在最后一个分区内',async()=>{
 const html=await render(true)
 expect(calls).toEqual([false])
 expect(html).toContain('has-scenes')
 expect(html).not.toContain('is-ready')
 expect(html.match(/<div\b[^>]*data-page-scene="last"[^>]*>([\s\S]*?)<\/div>/)?.[1]).toContain('data-test-footer')
 expect(html.match(/data-test-footer/g)).toHaveLength(1)
})
it('已启用整屏的页面走同一个场景容器，外层不重复占用页头高度',async()=>{
 sceneEnabled=true
 const html=await render()
 expect(calls).toEqual([true])
 expect(html).toContain('has-scenes')
 expect(html).toContain('is-ready')
 expect(html.match(/data-test-footer/g)).toHaveLength(1)
 expect(readFileSync('app/components/public/runtime/routes/ContentPage.vue','utf8')).toMatch(/\.content-page\.has-scenes\s*\{\s*padding-top:\s*0/)
})
