// 数据库测试必须显式执行；不混入日常 HTTP/纯单元测试。
import { defineConfig } from 'vitest/config'
import unitConfig from './vitest.config.ts'
export default defineConfig({ resolve: unitConfig.resolve, test: { environment: 'node', include: ['tests/database/**/*.test.ts'], fileParallelism: false, testTimeout: 30000, hookTimeout: 30000 } })
