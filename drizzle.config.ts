/// <reference types="node" />
// 命令行迁移配置：与 Nuxt 运行时共用私有变量，可单独指定迁移账号。
import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'
import { registerHooks } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// 仅Drizzle进程需要此别名；普通数据库命令继续使用现有Jiti配置。
registerHooks({resolve(specifier, context, nextResolve) {
  return nextResolve(specifier.startsWith('#shared/')
    ? pathToFileURL(resolve('shared', specifier.slice(8))).href
    : specifier, context)
}})

export default defineConfig({
  dialect: 'mysql',
  schema: './server/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_MIGRATION_URL || process.env.NUXT_DATABASE_URL || '' },
  strict: true,
  verbose: false,
})
