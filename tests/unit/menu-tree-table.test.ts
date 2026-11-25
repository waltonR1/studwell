import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {parse, compileScript} from '@vue/compiler-sfc'
import {renderToString} from '@vue/server-renderer'
import {createSSRApp, defineComponent, h} from 'vue'
import {transpileModule, ModuleKind} from 'typescript'
import {describe, expect, it} from 'vitest'

const {descriptor} = parse(readFileSync('app/components/admin/common/MenuTreeTable.vue', 'utf8'))
const compiled = compileScript(descriptor, {id: 'menu-tree-table', inlineTemplate: true})
const source = transpileModule(compiled.content, {compilerOptions: {module: ModuleKind.CommonJS}}).outputText
const module = {exports: {} as {default: ReturnType<typeof defineComponent>}}
new Function('require', 'module', 'exports', source)(createRequire(import.meta.url), module, module.exports)
async function render(businessColumns = false, busy = false, blocked = false) {
  const props = {rows: [{id:'one',name:'首屏',visible:true}],label:'测试列表',writable:true,canDelete:true,busy,filtered:false,
    hideDisabledReason:()=>blocked?'先下线页面':undefined,deleteDisabledReason:()=>blocked?'在页面维护删除':undefined,
    depth:()=>0,hasChildren:()=>false,expanded:()=>false,hiddenByParent:()=>false,canMove:()=>true}
  const app=createSSRApp({render:()=>h(module.exports.default,props,businessColumns?{
    head:()=>h('th','区域与栏目'),cells:()=>h('td','主体区')
  }:undefined)})
  app.component('AdminCommonTooltip',defineComponent({props:['text','disabledTarget'],setup:(props,{slots})=>()=>h('span',{tabindex:props.disabledTarget?0:undefined,'data-reason':props.text},slots.default?.())}))
  app.component('AdminCommonTable',defineComponent({setup:(_, {slots})=>()=>h('table',slots.default?.())}))
  app.component('AdminCommonRowActions',defineComponent({setup:(_, {slots})=>()=>h('div',slots.default?.())}))
  app.component('AdminCommonSwitchField',defineComponent({props:['label','disabled'],setup:props=>()=>h('button',{'aria-label':props.label,disabled:props.disabled},'开关')}))
  app.component('UButton',defineComponent({setup:(_, {attrs,slots})=>()=>h('button',attrs,slots.default?.())}))
  return renderToString(app)
}

describe('共用菜单与区块表格',()=>{
  it('默认保留菜单层级占位、通用显隐文案及删除操作',async()=>{
    const html=await render()
    expect(html).toContain('menu-tree-toggle-spacer')
    expect(html).toContain('首屏显示状态')
    expect(html).toContain('删除</button>')
  })
  it('区块复用排序与状态，支持业务列与统一编辑操作',async()=>{
    const html=await render(true)
    expect(html).toContain('menu-tree-toggle-spacer')
    expect(html).toContain('区域与栏目')
    expect(html).toContain('主体区')
    expect(html).toContain('首屏显示状态')
    expect(html).toContain('删除</button>')
    expect(html).toContain('aria-label="上移首屏"')
  })
  it('禁用显隐和删除时保留可聚焦的原因说明',async()=>{
    const html=await render(false,false,true)
    expect(html).toContain('tabindex="0" data-reason="先下线页面"')
    expect(html).toContain('tabindex="0" data-reason="在页面维护删除"')
    expect(html).toMatch(/aria-label="首屏显示状态" disabled/)
    expect(html).toMatch(/disabled[^>]*data-tone="danger"/)
  })
  it('提交期间锁定排序、显隐及移除',async()=>{
    const html=await render(true,true)
    expect(html).toMatch(/aria-label="上移首屏" disabled/)
    expect(html).toMatch(/aria-label="首屏显示状态" disabled/)
    expect(html).toMatch(/disabled[^>]*data-tone="danger"/)
  })
})
