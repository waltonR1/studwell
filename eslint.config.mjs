// 只检查代码正确性，不引入格式化规则或全项目自动修复。
import tseslint from 'typescript-eslint'
import vue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import {adminDependenciesRule} from './scripts/eslint/admin-dependencies.mjs'

const publicSharedBoundary = {
  regex: '(^#shared/|(^|/)shared/)(types|schemas|config|utils)/admin(/|$)',
  message: '官网代码不能依赖后台共享模块；请使用公共基础契约或官网自己的契约。',
}

export default [
  { ignores: ['node_modules/**', '.nuxt/**', '.output/**', '.data/**', '.cache/**', 'public/**', 'drizzle/**'] },
  ...tseslint.configs.recommended,
  ...vue.configs['flat/essential'],
  {
    // 对象剩余解构用于移除接口/查询字段；其余未使用变量仍报错。
    rules: { '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }] },
  },
  {
    // Nuxt 的页面和布局文件名由路由约定决定；组件名称由 components 的 prefix/pathPrefix 生成。
    files: ['app/pages/**/*.vue', 'app/layouts/**/*.vue', 'app/components/**/*.vue'],
    rules: { 'vue/multi-word-component-names': 'off' },
  },
  {
    // 官网只能使用公共基础契约，禁止引用后台业务共享模块。
    files: ['app/**/public/**/*.{ts,vue}', 'app/pages/**/*.{ts,vue}', 'app/layouts/default.vue'],
    ignores: ['app/pages/admin/**'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [publicSharedBoundary],
      }],
    },
  },
  {
    files: ['app/api/public/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [publicSharedBoundary, {
          regex: '^(?:(?:[~@]/|(?:~~|@@)/app/|(?:\\.\\.?/)+)(?:pages|layouts|components|composables|stores)(?:/|$)|(?:[~@]/api/|(?:\\.\\.?/)+)admin(?:/|$))',
          message: '官网 API 层不得反向依赖业务层，也不依赖后台 API。',
        }],
      }],
    },
  },
  {
    files: ['server/**/*.{ts,js,mjs}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          regex: '(^|/)scripts/database(?:/|\\.mjs$|$)',
          message: '数据库初始化由离线 CLI 管理，服务端运行模块不得引用初始化工具。',
        }],
      }],
    },
  },
  {
    files: ['app/{composables,stores,api,utils,config,types}/admin/**/*.{ts,vue}'],
    plugins: { 'admin-architecture': {rules: {'dependencies': adminDependenciesRule}} },
    rules: { 'admin-architecture/dependencies': 'error' },
  },
  {
    files: ['**/*.vue'],
    languageOptions: { parser: vueParser, parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.vue'] } },
  },
]
