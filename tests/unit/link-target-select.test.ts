import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {parse,compileScript} from '@vue/compiler-sfc'
import {cloneVNode,createRenderer,defineComponent,h,nextTick,ref} from 'vue'
import {transpileModule,ModuleKind} from 'typescript'
import {describe,expect,it} from 'vitest'
import * as targetHelpers from '../../shared/utils/website/link-target'
import * as siteLinkHelpers from '../../shared/utils/website/site-link'
import * as targetOptions from '../../app/utils/admin/site-settings/targets'
import {createSiteLink,emptySiteText} from '../../shared/utils/admin/site-settings'
import type {LinkTarget} from '../../shared/schemas/website/link-target'
import type {SiteTarget} from '../../shared/types/admin/site-settings'

const {descriptor}=parse(readFileSync('app/components/admin/website/shared/LinkTargetSelect.vue','utf8'))
const script=compileScript(descriptor,{id:'link-target-select',inlineTemplate:true})
const result={exports:{} as {default:ReturnType<typeof defineComponent>}}
const require=createRequire(import.meta.url)
const compiled=transpileModule(script.content,{compilerOptions:{module:ModuleKind.CommonJS}}).outputText
new Function('require','module','exports',compiled)((name:string)=>name==='#shared/utils/website/link-target'?targetHelpers:name==='#shared/utils/website/site-link'?siteLinkHelpers:name==='~/utils/admin/site-settings/targets'?targetOptions:require(name),result,result.exports)
const make=(module:string,type:'page'|'anchor'|'news-category',resourceId:string,label:string,value='',path='/'+module):SiteTarget=>({key:`${type}:${module}:${value}`,resourceId,path,label:{...emptySiteText(),zh:label},target:{module,type,resourceId,value}})
const targets=[make('about','page','123','关于我们'),make('news','page','456','新闻中心'),make('about','anchor','123','历史沿革','history','/about#history'),make('news','news-category','456','行业观察','industry','/news?category=industry#news-list')]
type Node={type:string;text:string;props:Record<string,unknown>;children:Node[];parent:Node|null;focus:()=>void;querySelectorAll:(selector:string)=>Node[]}
const all=(node:Node):Node[]=>[node,...node.children.flatMap(all)]
const text=(node:Node):string=>node.text+node.children.map(text).join('')
const flush=async()=>{await nextTick();await nextTick()}
async function mount(value:LinkTarget|null,extra:Record<string,unknown>={}){
 let focused:Node|null=null
 function node(type:string,content=''):Node{
  const item:Node={type,text:content,props:{},children:[],parent:null,focus(){focused=item},querySelectorAll(){return all(item).filter(n=>'data-link-choice' in n.props)}}
  return item
 }
 const renderer=createRenderer<Node,Node>({
  createElement:type=>node(type),createText:value=>node('#text',value),createComment:value=>node('#comment',value),
  setText:(item,value)=>{item.text=value},setElementText:(item,value)=>{item.text=value;item.children=[]},
  patchProp:(item,key,_previous,value)=>{item.props[key]=value},parentNode:item=>item.parent,nextSibling:item=>item.parent?.children[item.parent.children.indexOf(item)+1]??null,
  insert(item,parent,anchor){if(item.parent)item.parent.children.splice(item.parent.children.indexOf(item),1);item.parent=parent;const index=anchor?parent.children.indexOf(anchor):-1;if(index<0)parent.children.push(item);else parent.children.splice(index,0,item)},
  remove(item){if(item.parent)item.parent.children.splice(item.parent.children.indexOf(item),1);item.parent=null},
 })
 const popover=defineComponent({props:['open'],emits:['update:open'],setup(props,{slots,emit}){return()=>h('popover-root',{},[
  ...(slots.default?.({open:props.open})??[]).map(vnode=>cloneVNode(vnode,{onClick:()=>emit('update:open',!props.open)})),
  ...(props.open?slots.content?.({close:()=>emit('update:open',false)})??[]:[]),
 ])}})
 const model=ref<LinkTarget|null>(value),settings=ref(extra),emitted:Array<LinkTarget|null>=[]
 const root=node('root')
 const app=renderer.createApp({render:()=>h(result.exports.default,{modelValue:model.value,label:'跳转目标',locale:'zh',targets,allowEmpty:true,...settings.value,'onUpdate:modelValue':(next:LinkTarget|null)=>{emitted.push(next);model.value=next}})})
 app.component('UPopover',popover)
 app.component('AdminCommonFeedback',defineComponent({setup(_,ctx){return()=>h('div',{},ctx.slots.default?.())}}))
 app.component('UButton',defineComponent({setup(_,ctx){return()=>h('button',ctx.attrs,ctx.slots.default?.())}}))
 app.mount(root);await flush()
 const buttons=()=>all(root).filter(n=>n.type==='button')
 function button(name:string){const item=buttons().find(n=>n.props['aria-label']===name||!n.props['aria-label']&&text(n)===name);if(!item)throw new Error('Button not found: '+name);return item}
 function input(label:string){const item=all(root).find(n=>n.type==='input'&&n.props['aria-label']===label);if(!item)throw new Error('Input not found: '+label);return item}
 async function click(name:string){(button(name).props.onClick as ()=>void)();await flush()}
 async function type(label:string,value:string){(input(label).props.onInput as (event:{target:{value:string}})=>void)({target:{value}});await flush()}
 return {root,model,emitted,settings,buttons,button,input,click,type,focused:()=>focused}
}

describe('单面板跳转目标选择器',()=>{
 it('所有目标类型收起后都只保留一个选择框',async()=>{
  for(const value of [null,createSiteLink('new_link').target,...targets.map(item=>item.target),{type:'custom' as const,value:'https://example.com'}]){
   const view=await mount(value,{allowEmpty:false})
   expect(view.buttons()).toHaveLength(1)
   expect(all(view.root).filter(n=>n.type==='input')).toHaveLength(0)
   expect(text(view.button('跳转目标'))).not.toContain('__')
  }
  const required=await mount(null,{allowEmpty:false})
  expect(text(required.button('跳转目标'))).toBe('选择跳转目标')
  const optional=await mount(null)
  expect(text(optional.button('跳转目标'))).toBe('不跳转')
 })
 it('页面、区块和分类在同一面板直接选择，选中后显示完整名称',async()=>{
  const view=await mount(null)
  await view.click('跳转目标')
  expect(view.button('关于我们 / 页面')).toBeDefined()
  expect(view.button('关于我们 / 历史沿革')).toBeDefined()
  expect(view.button('新闻中心 / 行业观察')).toBeDefined()
  await view.click('关于我们 / 历史沿革')
  expect(view.model.value).toEqual(targets[2]!.target)
  expect(text(view.button('跳转目标'))).toBe('关于我们 / 历史沿革')
  expect(view.buttons()).toHaveLength(1)
  await view.click('跳转目标')
  await view.click('新闻中心 / 行业观察')
  expect(view.model.value).toEqual(targets[3]!.target)
  expect(text(view.button('跳转目标'))).toBe('新闻中心 / 行业观察')
  expect(view.buttons()).toHaveLength(1)
 })
 it('搜索区块名称或路径时保留所属页面，支持方向键进入选择列表',async()=>{
  const view=await mount(null)
  await view.click('跳转目标')
  await view.type('搜索页面、区块或新闻分类','历史')
  expect(view.button('关于我们 / 页面')).toBeDefined()
  expect(view.button('关于我们 / 历史沿革')).toBeDefined()
  expect(view.buttons().some(n=>n.props['aria-label']==='新闻中心 / 页面')).toBe(false)
  const input=view.input('搜索页面、区块或新闻分类')
  ;(input.props.onKeydown as (event:unknown)=>void)({key:'ArrowDown',target:input,preventDefault(){}})
  expect(view.focused()).toBe(view.button('不跳转'))
  await view.type('搜索页面、区块或新闻分类','industry')
  expect(view.button('新闻中心 / 行业观察')).toBeDefined()
 })
 it('自定义链接在面板内填写，确认有效地址后才更新表单',async()=>{
  const view=await mount(targets[0]!.target)
  await view.click('跳转目标');await view.click('自定义链接')
  expect(view.emitted).toEqual([])
  await view.type('跳转目标地址','javascript:alert(1)')
  await view.click('使用此链接')
  expect(view.emitted).toEqual([])
  expect(all(view.root).some(n=>n.props.role==='alert')).toBe(true)
  await view.type('跳转目标地址','  https://example.com/company  ')
  await view.click('使用此链接')
  expect(view.emitted).toEqual([{type:'custom',value:'https://example.com/company'}])
  expect(text(view.button('跳转目标'))).toBe('https://example.com/company')
  expect(view.buttons()).toHaveLength(1)
  expect(all(view.root).filter(n=>n.type==='input')).toHaveLength(0)
 })
 it('取消或返回时不写入自定义草稿，重新打开回显原地址',async()=>{
  const original={type:'custom' as const,value:'/contact'}
  const view=await mount(original)
  await view.click('跳转目标')
  expect(view.input('跳转目标地址').props.value).toBe('/contact')
  await view.type('跳转目标地址','/changed');await view.click('取消')
  expect(view.emitted).toEqual([])
  expect(view.model.value).toEqual(original)
  await view.click('跳转目标')
  expect(view.input('跳转目标地址').props.value).toBe('/contact')
  await view.click('返回目标列表')
  expect(view.button('关于我们 / 页面')).toBeDefined()
  expect(view.emitted).toEqual([])
 })
 it('不跳转直接清空目标；必选字段不提供清空选项',async()=>{
  const optional=await mount(targets[2]!.target)
  await optional.click('跳转目标');await optional.click('不跳转')
  expect(optional.emitted).toEqual([null])
  expect(text(optional.button('跳转目标'))).toBe('不跳转')
  const required=await mount(null,{allowEmpty:false})
  await required.click('跳转目标')
  expect(required.buttons().some(n=>n.props['aria-label']==='不跳转')).toBe(false)
 })
 it('加载、错误和禁用状态不可打开；失效目标提示重新选择',async()=>{
  for(const extra of [{loading:true},{error:'加载失败'},{disabled:true}]){
   const view=await mount(null,extra)
   expect(view.button('跳转目标').props.disabled).toBe(true)
  }
  const view=await mount({type:'page',module:'gone',resourceId:'999',value:''})
  expect(text(view.button('跳转目标'))).toBe('当前目标不可用，请重新选择')
  await view.click('跳转目标')
  view.settings.value={disabled:true};await flush()
  expect(all(view.root).filter(n=>n.type==='input')).toHaveLength(0)
 })
})
