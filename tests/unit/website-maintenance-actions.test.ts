import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {parse, compileScript} from '@vue/compiler-sfc'
import {renderToString} from '@vue/server-renderer'
import {createSSRApp, defineComponent, h} from 'vue'
import {transpileModule, ModuleKind} from 'typescript'
import {describe, expect, it} from 'vitest'

const actions=readFileSync('app/components/admin/website/shared/MaintenanceFrame.vue','utf8').match(/<template #actions>([\s\S]*?)<\/template>/)![1]
const {descriptor} = parse(`<script setup lang="ts">import {ref} from 'vue';defineProps<{page:string;view:Record<string,boolean>;adapter:{save:()=>void;publish:()=>void;withdraw:()=>void}}>();const historyOpen=ref(false)</script><template>${actions}</template>`)
const compiled = compileScript(descriptor, {id: 'website-editor-actions', inlineTemplate: true})
const source = transpileModule(compiled.content, {compilerOptions: {module: ModuleKind.CommonJS}}).outputText
const module = {exports: {} as {default: ReturnType<typeof defineComponent>}}
new Function('require', 'module', 'exports', source)(createRequire(import.meta.url), module, module.exports)
async function buttons(overrides: Record<string, boolean | string> = {}, extra = false) {
  const props = {canEdit: true, canPublish: true, historyEnabled: true, saveEnabled: true,
    publishEnabled: true, busy: false, saving: false, ...overrides}
  const app = createSSRApp({render: () => h(module.exports.default, {page:'basic',view:{...props,showWithdraw:extra,withdrawDisabled:props.busy},adapter:{save(){},publish(){},withdraw(){}}})})
  app.component('UButton', defineComponent({setup: (_, {attrs, slots}) => () => h('button', attrs, slots.default?.())}))
  const html = await renderToString(app)
  return [...html.matchAll(new RegExp('<button([^>]*)>(.*?)</button>', 'g'))].map(([,attrs,text]) => ({text, disabled: attrs!.includes('disabled')}))
}

describe('网站维护共用操作区', () => {
  it('只读账号保留历史入口，隐藏保存和发布', async () => {
    expect(await buttons({canEdit: false, canPublish: false})).toEqual([{text: '发布记录', disabled: false}])
  })
  it('遵循模块提供的草稿、发布和历史可用条件', async () => {
    expect(await buttons({historyEnabled: false, saveEnabled: true, publishEnabled: false})).toEqual([
      {text: '发布记录', disabled: true}, {text: '发布', disabled: true}, {text: '保存草稿', disabled: false}])
    expect(await buttons({saveEnabled: false, publishEnabled: true})).toEqual([
      {text: '发布记录', disabled: false}, {text: '发布', disabled: false}, {text: '保存草稿', disabled: true}])
  })
  it('提交期间禁用共用按钮，保留下线插槽并显示保存状态', async () => {
    expect(await buttons({busy: true, saving: true}, true)).toEqual([
      {text: '发布记录', disabled: true}, {text: '发布', disabled: true},
      {text: '保存中…', disabled: true}, {text: '下线', disabled: true}])
  })
})

it('Toast 只在消息节点声明 live role，避免错误消息重复播报',()=>{
 const source=readFileSync('app/components/admin/common/Toast.vue','utf8')
 const region=source.match(/<div class="admin-toast-region"[^>]*>/)?.[0] ?? ''
 const message=source.match(/<div v-if="notification"[^>]*>/)?.[0] ?? ''
 expect(region).not.toMatch(/role=|aria-live=/)
 expect(message).toContain(':role="notification.tone === \'error\' ? \'alert\' : \'status\'"')
 expect(message).toContain('aria-atomic="true"')
})

it('历史整页预览只有在加载成功、具备权限且非当前版本时才能回滚',async()=>{
 const source=readFileSync('app/components/admin/website/pages/ReleasePreview.vue','utf8')
 const action=source.match(/<UButton v-if="detail&&!detail.isCurrent&&canPublish"[\s\S]*?<\/UButton>/)![0]
 const {descriptor}=parse(`<script setup lang="ts">defineProps<{detail:{isCurrent:boolean}|null;canPublish:boolean;ready:boolean;busy:boolean;detailPending:boolean}>();const emit=()=>{}</script><template>${action}</template>`)
 const script=compileScript(descriptor,{id:'release-restore',inlineTemplate:true})
 const compiled=transpileModule(script.content,{compilerOptions:{module:ModuleKind.CommonJS}}).outputText
 const result={exports:{} as {default:ReturnType<typeof defineComponent>}}
 new Function('require','module','exports',compiled)(createRequire(import.meta.url),result,result.exports)
 async function render(overrides:Record<string,unknown>={}){
  const app=createSSRApp({render:()=>h(result.exports.default,{detail:{isCurrent:false},canPublish:true,ready:true,busy:false,detailPending:false,...overrides})})
  app.component('UButton',defineComponent({setup:(_,{attrs,slots})=>()=>h('button',attrs,slots.default?.())}))
  return renderToString(app)
 }
 expect(await render()).toContain('回滚到此版本')
 expect(await render()).not.toContain('disabled')
 expect(await render({ready:false})).toContain('disabled')
 expect(await render({busy:true})).toContain('disabled')
 expect(await render({detailPending:true})).toContain('disabled')
 expect(await render({canPublish:false})).not.toContain('<button')
 expect(await render({detail:{isCurrent:true}})).not.toContain('<button')
 expect(await render({detail:null})).not.toContain('<button')
})
