// 专用测试库配置保护：仅供测试套件及测试夹具导入，不作为独立命令执行。
// 仅检查测试上下文、连接格式、声明库名和跨环境同名冲突，不连接数据库或验证实际实例属性。
function parseConnection(value) {
  try {
    const url = new URL(value)
    const name = decodeURIComponent(url.pathname.slice(1))
    if (url.protocol !== 'mysql:' || !url.hostname || !name || name.includes('/')) throw new Error()
    return { host: url.hostname.toLowerCase(), port: url.port || '3306', name }
  } catch {
    throw new Error('数据库连接配置无效')
  }
}

export function validateTestDatabase(env) {
  if (env.NODE_ENV !== 'test') throw new Error('只允许在 NODE_ENV=test 下使用测试库')
  if (!env.TEST_DATABASE_URL || !env.TEST_DATABASE_NAME) throw new Error('缺少专用测试库配置')
  const target = parseConnection(env.TEST_DATABASE_URL)
  if (!/^studwell_test(?:_[a-z0-9]+)*$/.test(env.TEST_DATABASE_NAME) || target.name !== env.TEST_DATABASE_NAME) {
    throw new Error('测试库必须匹配显式声明的 studwell_test 名称')
  }
  // 不依赖主机名比较：即使地址或代理别名不同，也禁止测试库与运行/迁移库同名（忽略大小写）。
  for (const key of ['NUXT_DATABASE_URL', 'DATABASE_MIGRATION_URL']) {
    if (env[key] && parseConnection(env[key]).name.toLowerCase() === target.name.toLowerCase()) {
      throw new Error('测试库不得与运行库或迁移库同名')
    }
  }
  return target
}
