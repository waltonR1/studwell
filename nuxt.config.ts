import {supportedLanguageCatalog,defaultSiteLanguages} from './shared/config/site-languages'
import { resolve } from 'node:path'
import { buildTaskWorker } from './scripts/build-task-worker'
import sectionRendererInventory from './scripts/build-section-renderer-inventory'


export default defineNuxtConfig({
  serverHandlers: [{route: '/_ipx/**', handler: '~~/server/runtime/images.ts'}],
  nitro: {
    virtual:{'#section-renderer-inventory':`export default ${JSON.stringify(sectionRendererInventory)}`},
    // 运行期文件只保留一份持久副本，避免构建产物留下已删除素材。
    ignore: [resolve('public/uploads/**'), resolve('public/search/**')],
    esbuild: { options: { target: 'node24' } },
    hooks: { compiled: async nitro => { await buildTaskWorker(resolve(nitro.options.output.serverDir, 'task-worker.mjs')) } },
  },
  compatibilityDate: '2026-10-12',

  runtimeConfig: {
    // 数据库仅供服务端使用，部署时由 NUXT_DATABASE_URL 注入。
    databaseUrl: '',
    mediaStoragePath: '',
    // 管理端可信 Origin 必须显式配置；默认不信任任何反向代理头。
    adminOrigin: '',
    adminCookieSecure: process.env.NODE_ENV === 'production',
    adminTrustedProxyIps: '',
    inquirySmtpUrl: '',
  },

  devtools: {
    enabled: true
  },

  // 管理页面含会话投影与 CSRF，禁止共享缓存或搜索收录；官网缓存策略不变。
  routeRules: {
    '/admin': { headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } },
    '/admin/**': { headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } },
  },

  modules: [
    '@nuxtjs/i18n',
    '@nuxt/image',
    '@nuxt/ui',
    // 后台身份、业务状态与资源生命周期由组合式 Pinia store 管理。
    '@pinia/nuxt',
    // 后台自行隔离，避免给官网根节点新增堆叠上下文。
    (_options, nuxt) => {
      nuxt.options.app.rootAttrs.class = String(nuxt.options.app.rootAttrs.class ?? '').split(' ').filter(value => value !== 'isolate').join(' ')
    }
  ],

  // 公开站与后台组件分目录维护；公开站保留现有自动导入名称。
  components: [
    { path: '~/components/public', pathPrefix: true },
    { path: '~/components/admin', prefix: 'Admin', pathPrefix: true },
  ],

  css: ['~/assets/public/css/runtime/themes/studwell/main.css'],

  // 无样式组件由后台作用域样式呈现，不引入 UI 全局主题/Preflight。
  ui: { fonts: false, colorMode: false, theme: { unstyled: true } },

  i18n: {
    // 构建注册系统语言能力；本站公开默认语言由已发布配置决定。
    defaultLocale: defaultSiteLanguages.defaultLocale,

    strategy: 'prefix',

    detectBrowserLanguage: false,

    locales: supportedLanguageCatalog.map(({code,name,language,file})=>({code,name,language,file}))
  }
})
