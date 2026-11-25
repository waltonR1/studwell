// 当前仅执行隔离单元测试；真实 MySQL 集成测试须显式接入专用测试库。
import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '#section-renderer-inventory':fileURLToPath(new URL('./scripts/build-section-renderer-inventory.ts',import.meta.url)),
      '~': fileURLToPath(new URL('./app', import.meta.url)),
      '#shared': fileURLToPath(new URL('./shared', import.meta.url))
    }
  },
  test: { environment: 'node', include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'], restoreMocks: true },
})
