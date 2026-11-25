// 运行环境检查：npm run runtime:check；开发、构建、预览和生产启动命令也会调用。
// 按项目基线检查 Node >=24.22.1 <25 及内置 Undici 的允许版本；不通过时返回非零退出码。
// 只检查当前进程的版本，不检查 npm 安装的同名依赖，也不会安装或升级运行环境。
const [major, minor, patch] = process.versions.node.split('.').map(Number)
const [undiciMajor, undiciMinor, undiciPatch] = (process.versions.undici ?? '0.0.0').split('.').map(Number)
const nodeSupported = /^\d+\.\d+\.\d+$/.test(process.versions.node)
  && major === 24 && (minor > 22 || (minor === 22 && patch >= 1))
const undiciPatched = /^\d+\.\d+\.\d+$/.test(process.versions.undici ?? '')
  && ((undiciMajor === 7 && (undiciMinor > 30 || (undiciMinor === 30 && undiciPatch >= 1)))
    || (undiciMajor === 8 && (undiciMinor > 12 || (undiciMinor === 12 && undiciPatch >= 2))))

if (!nodeSupported || !undiciPatched) {
  console.error(`[runtime] Requires Node >=24.22.1 <25 with patched bundled Undici (7.x >=7.30.1 or 8.x >=8.12.2); got Node ${process.versions.node}, Undici ${process.versions.undici ?? 'unknown'}.`)
  process.exitCode = 1
} else {
  console.log(`[runtime] Node ${process.versions.node}, bundled Undici ${process.versions.undici}: OK`)
}
