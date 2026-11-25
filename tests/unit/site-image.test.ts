import imageRules from '../fixtures/media/image-rules'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parse, compileScript } from '@vue/compiler-sfc'
import { renderToString } from '@vue/server-renderer'
import { createSSRApp, computed, defineComponent, h, ref } from 'vue'
import { transpileModule, ModuleKind } from 'typescript'
import { describe, expect, it } from 'vitest'
import { resolveContentLocale } from '../../app/utils/public/runtime/locale'
import {containImageOffset,resolveImagePresentation} from '../../shared/utils/image-presentation'

// Compile the real SFC: no Vue plugin or Nuxt server needed for this rendering contract.
const require = createRequire(import.meta.url)
const { descriptor } = parse(readFileSync('app/components/public/ui/SiteImage.vue', 'utf8'))
const compiled = compileScript(descriptor, { id: 'site-image', inlineTemplate: true })
const source = transpileModule(compiled.content, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText
function component(language: string) {
  const module = { exports: {} as { default: ReturnType<typeof defineComponent> } }
  const localRequire = (id: string) => id.includes('runtime/locale') ? { resolveContentLocale } : id.includes('utils/image-presentation')?{containImageOffset,resolveImagePresentation}:require(id)
  new Function('require', 'module', 'exports', 'computed', 'useI18n', source)(localRequire, module, module.exports, computed, () => ({ locale: ref(language) }))
  return module.exports.default
}
async function render(props: Record<string, unknown>, language = 'en') {
  const app = createSSRApp({ render: () => h(component(language), props) })
  app.component('NuxtImg', defineComponent({ inheritAttrs: false, setup: (_, { attrs }) => () => h('img', { ...attrs, 'data-optimized': 'true' }) }))
  return renderToString(app)
}

describe('官网共用图片渲染兼容性', () => {
  it('统一配置驱动完整显示、设备取景与独立缩放，不覆盖模板悬停 transform',async()=>{
    const html=await render({image:{src:'/certificate.jpg',alt:'Certificate',imagePreset:imageRules['contain'],presentation:{desktop:{x:40,y:70,zoom:1.5},mobile:{x:60,y:50,zoom:1.2},opacity:.8,brightness:1.1}}})
    expect(html).toContain('object-fit:contain')
    expect(html).toContain('--image-desktop-offset:-2% 4%')
    expect(html).toContain('--image-mobile-offset:2% 0%')
    expect(html).toContain('translate:var(--image-offset)')
    expect(html).toContain('scale:var(--image-zoom)')
    expect(html).not.toContain(';transform:')
    expect(html).toContain('opacity:0.8')
  })
  it('原图模式保持单个 img、尺寸、srcset、加载参数和 CSS 类', async () => {
    const html = await render({ image: { src: '/logo.png', alt: 'Logo', width: 300, height: 110, srcSet: '/logo.png 1x, /logo@2x.png 2x' }, class: 'brand-logo', fetchpriority: 'high' })
    expect(html).toBe('<img src="/logo.png" alt="Logo" width="300" height="110" srcset="/logo.png 1x, /logo@2x.png 2x" class="brand-logo" fetchpriority="high">')
  })
  it('保留显式裁切尺寸和优化参数，不新增展示容器', async () => {
    const html = await render({ optimized: true, image: { src: '/photo.jpg', alt: 'Photo', width: 800, height: 600 }, width: '1536', height: '1024', class: 'media-photo', loading: 'lazy', fetchpriority: 'low', sizes: '50vw', densities: '1', format: 'webp', quality: '82' })
    expect(html).toContain('width="1536" height="1024"')
    for (const attribute of ['class="media-photo"', 'loading="lazy"', 'fetchpriority="low"', 'sizes="50vw"', 'densities="1"', 'format="webp"', 'quality="82"', 'data-optimized="true"']) expect(html).toContain(attribute)
    expect(html.startsWith('<img ')).toBe(true)
    expect(html).not.toContain('<div')
  })
  it('支持本地多语言和装饰图，拒绝非法语言', async () => {
    const image = { src: '/photo.jpg', alt: { zh: '中文', en: 'English', fr: 'Français', es: 'Español', pt: 'Português' } }
    expect(await render({ image }, 'zh')).toContain('alt="中文"')
    await expect(render({image},'unknown')).rejects.toThrow('Unsupported content locale')
    expect(await render({ image, alt: '' }, 'zh')).toBe('<img src="/photo.jpg" alt>')
  })
})

it('直接消费未登记的数据库图片规则，不按预设代称覆盖',async()=>{
 const rule={...imageRules.contain,label:'自定义规则',fit:'cover' as const,maxZoom:2,opacity:{value:.6,min:.6,max:.6,editable:false}}
 const html=await render({image:{src:'/custom.jpg',alt:'Custom',imagePreset:rule,presentation:{opacity:1}}})
 expect(html).toContain('object-fit:cover')
 expect(html).toContain('opacity:0.6')
})
