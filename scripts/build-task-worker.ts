// 定时任务执行器构建工具：供 Nuxt 构建钩子、数据库测试及 npm run build:task-worker 使用。
// 将 server/tasks/worker.ts 打包为 Node 24 ESM；mysql2、drizzle-orm 保留为外部依赖。
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
export async function buildTaskWorker(outfile: string) {
  await build({
    entryPoints: [fileURLToPath(new URL('../server/tasks/worker.ts', import.meta.url))],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    // 独立 esbuild 构建不经过 Nuxt，需要显式声明共享目录别名。
    alias: { '#shared': fileURLToPath(new URL('../shared', import.meta.url)) },
    external: ['mysql2', 'drizzle-orm', 'drizzle-orm/*'],
    logLevel: 'silent',
  })
}

// 直接执行时默认输出 .output/server/task-worker.mjs，--output 可指定路径。
// 被构建钩子或测试导入时只提供构建函数，由调用方指定输出并执行。
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { output: { type: 'string' } } })
  const outfile = values.output ? resolve(values.output) : fileURLToPath(new URL('../.output/server/task-worker.mjs', import.meta.url))
  await buildTaskWorker(outfile)
  console.log('[build] 任务执行器已生成：', outfile)
}
