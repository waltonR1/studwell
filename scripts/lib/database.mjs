// 数据库 CLI 公共模块：参数校验、环境文件读取和目标连接选择，由 database.mjs 与测试导入。
// 不单独执行、不建立数据库连接；实际库名核验和交互确认由主入口完成。
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { parseArgs } from 'node:util'
import { parse } from 'dotenv'

export function parseDatabaseCommand(args) {
  const {values,positionals}=parseArgs({args,options:{help:{type:'boolean',short:'h'},'dry-run':{type:'boolean'},'media-root':{type:'string'}},allowPositionals:true})
  if(values.help||!args.length)return {action:'help'}
  const action=positionals.join(' ')
  if(!['init','site','samples','migrate','check','generate','sync:rbac'].includes(action))throw new Error('DB_COMMAND_INVALID')
  if(values['media-root']!==undefined&&(action!=='site'||!values['media-root'].trim()))throw new Error('DB_OPTIONS_INVALID')
  if(values['dry-run']!==undefined&&['check','generate'].includes(action))throw new Error('DB_OPTIONS_INVALID')
  return {action,dryRun:values['dry-run']===true,...(values['media-root']?{mediaRoot:values['media-root']}:{})}
}

function readEnv(path) {
  try { return parse(readFileSync(path)) } catch (error) { if (error.code === 'ENOENT') return {}; throw new Error('DB_ENV_READ_FAILED') }
}
export function loadDatabaseEnvironment(root, shellEnv = process.env) {
  return { ...readEnv(new URL('.env', root)), ...shellEnv }
}

function connection(value) {
  // 本地字符串校验，不解析 DNS；仅将 localhost 与 127.0.0.1 视为同一主机。
  try {
    const url = new URL(value), name = decodeURIComponent(url.pathname.slice(1))
    if (url.protocol !== 'mysql:' || !url.hostname || !/^[a-zA-Z0-9_]+$/.test(name)) throw new Error()
    const host = url.hostname.toLowerCase() === 'localhost' ? '127.0.0.1' : url.hostname.toLowerCase()
    return { name, host, port: url.port || '3306' }
  } catch { throw new Error('DB_CONNECTION_INVALID') }
}
export function resolveDatabaseTarget(command, env) {
  const runtime = connection(env.NUXT_DATABASE_URL)
  // 仅开发库迁移允许使用独立账号，其实例、端口和库名必须与运行连接一致。
  const url = command.action === 'migrate' && env.DATABASE_MIGRATION_URL ? env.DATABASE_MIGRATION_URL : env.NUXT_DATABASE_URL
  const selected = connection(url)
  if (/(?:^|_)test(?:_|$)/i.test(selected.name)) throw new Error('DB_TEST_DATABASE_FORBIDDEN')
  if (selected.name !== runtime.name || selected.host !== runtime.host || selected.port !== runtime.port) throw new Error('DB_MIGRATION_TARGET_MISMATCH')
  return { url, name: selected.name }
}

// 迁移时间与历史核验，与选库规则共用现有数据库辅助模块。
export function validateMigrationJournal(entries) {
  let previous = -1
  for (const [index, entry] of entries.entries()) {
    if (entry.idx !== index || !/^[0-9]{4}_[a-z0-9_]+$/.test(entry.tag) || !Number.isSafeInteger(entry.when) || entry.when <= previous) throw new Error('DB_MIGRATION_JOURNAL_ORDER_INVALID')
    previous = entry.when
  }
  if (new Set(entries.map(entry=>entry.tag)).size !== entries.length) throw new Error('DB_MIGRATION_JOURNAL_DUPLICATE')
}

export function readMigrationManifest(folder) {
  const journal = JSON.parse(readFileSync(join(folder,'meta/_journal.json'),'utf8'))
  validateMigrationJournal(journal.entries)
  return journal.entries.map(entry=>({...entry, hash:createHash('sha256').update(readFileSync(join(folder,`${entry.tag}.sql`))).digest('hex')}))
}

// 只校正本次新生成记录；已存在的journal和SQL均不可改写。
export function normalizeGeneratedJournal(previous, next) {
  if (JSON.stringify(next.slice(0,previous.length)) !== JSON.stringify(previous)) throw new Error('DB_MIGRATION_HISTORY_REWRITTEN')
  validateMigrationJournal(previous)
  let latest = previous.at(-1)?.when ?? -1
  const normalized = next.map((entry,index)=> {
    if (index < previous.length) return entry
    const when = Math.max(entry.when,latest+1)
    if (!Number.isSafeInteger(when)) throw new Error('DB_MIGRATION_JOURNAL_ORDER_INVALID')
    latest = when
    return {...entry,when}
  })
  validateMigrationJournal(normalized)
  return normalized
}
export function finishGeneratedJournal(folder, previous) {
  const path=join(folder,'meta/_journal.json'), journal=JSON.parse(readFileSync(path,'utf8'))
  const entries=normalizeGeneratedJournal(previous,journal.entries)
  if (JSON.stringify(entries)!==JSON.stringify(journal.entries)) writeFileSync(path,JSON.stringify({...journal,entries},null,2)+'\n')
}

export function inspectMigrationHistory(manifest, rows) {
  const currentHashes=new Set(manifest.map(entry=>entry.hash))
  const unknown = rows.filter(row=>!currentHashes.has(row.hash))
  if (unknown.length) {
    const error = new Error('DB_MIGRATION_HISTORY_UNKNOWN')
    // 仅保存经过类型约束的迁移凭据，不携带查询、连接或底层异常文本。
    error.migrationDetails = unknown.slice(0, 10).map(row => ({
      hash: typeof row.hash === 'string' && /^[a-f0-9]{64}$/i.test(row.hash) ? row.hash : '（非 SHA-256 格式）',
      createdAt: /^\d{1,16}$/.test(String(row.created_at)) ? String(row.created_at) : '（无效时间）',
    }))
    error.migrationCount = unknown.length
    throw error
  }
  const applied=new Set(rows.map(row=>row.hash)), latest=Math.max(-1,...rows.map(row=>Number(row.created_at)))
  return manifest.map(entry=> {
    const status=applied.has(entry.hash)?'applied':entry.when>latest?'pending':'gap'
    return {tag:entry.tag,status}
  })
}
export async function readMigrationHistory(pool, manifest) {
  const [[table]]=await pool.query("SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='__drizzle_migrations'")
  const rows=Number(table.count)?(await pool.query('SELECT hash, created_at FROM __drizzle_migrations'))[0]:[]
  return inspectMigrationHistory(manifest,rows)
}
export function requireMigrationState(state, migrating=false) {
  if (state.some(item=>item.status==='gap')) throw new Error('DB_MIGRATION_HISTORY_GAP')
  if (!migrating && state.some(item=>item.status==='pending')) throw new Error('DB_MIGRATION_REQUIRED')
}
export function safeDatabaseErrorCode(error) {
  const seen=new Set()
  for(let current=error;current && typeof current==='object' && !seen.has(current);current=current.cause){
    seen.add(current)
    if(typeof current.code==='string' && /^ER_[A-Z0-9_]{1,64}$/.test(current.code)) return current.code
  }
  return undefined
}

const databaseErrorHints = {
  DB_SYSTEM_INIT_REQUIRED: ['请先执行 npm run db:init，准备系统数据与有效 Root；不会自动执行系统初始化。'],
  DB_OPTIONS_INVALID: ['参数不适用于当前命令，请运行 npm run db -- --help 查看用法。'],
  DB_TEST_DATABASE_FORBIDDEN: ['数据库管理命令不能指向专用测试库，请核对本站连接。'],

  DB_SAMPLE_SITE_REQUIRED: ['请先执行 npm run db:site 填入本站内容，再补充样例；样例不是本站内容的替代品。'],
  DB_SITE_MEDIA_CLEANUP_REQUIRED: ['内容事务已回滚，但本次上传文件未完全清理，请核对媒体目录。'],
  DB_SITE_ROOT_REQUIRED: ['本站内容初装需要已启用且未删除的 Root，请先执行 npm run db:init。'],
  DB_SITE_CONTENT_CONFLICT: ['目标已有部分站点内容、草稿或路由，初装已停止，保留现有数据。请通过后台检查并处理。'],
  DB_SITE_LANGUAGE_CONFLICT: ['本站初装内容为中文；请核对当前语言配置，不会自动改写已有语言。'],
  DB_SITE_MODULES_REQUIRED: ['本站初装依赖新闻、招聘与问询模块，请核对模块配置。'],
  DB_SITE_TEMPLATE_REQUIRED: ['本站初装缺少模板，请重新执行 npm run db:site 补齐模板。'],
  DB_TEMPLATE_ROOT_REQUIRED: ['模板写入需要已启用且未删除的 Root，请先初始化对应库的 Root。'],
  DB_PASSWORD_LENGTH_INVALID: ['密码长度不符合当前密码策略。请按下方字符数范围重新输入。'],
  DB_PASSWORD_BLOCKED: ['密码命中了已知弱口令名单。请换用不常见的密码或口令短语。'],
  DB_PASSWORD_CONFIRMATION_FAILED: ['两次输入的密码不一致，请重新执行并输入相同密码。'],
  DB_INPUT_INVALID: ['业务输入校验失败。请检查下方字段及初始化模板。'],
  DB_PRESETS_ROOT_REQUIRED: ['安装预设前请先执行 npm run db:init。'],
  DB_SYSTEM_SEED_PASSWORD_REQUIRED: ['缺少新增示例账号初始密码，请重新执行并输入非空密码。'],
  DB_SYSTEM_SEED_ROLE_DISABLED: ['示例账号所需的预设角色未启用，请检查已有角色状态。'],
  DB_MIGRATION_HISTORY_UNKNOWN: ['数据库迁移历史中存在本地 drizzle/*.sql 无法匹配的 SHA-256 哈希，已停止执行迁移。', '可能原因：已执行的 SQL 文件被修改或删除、当前分支缺少迁移文件，或目标库使用了另一套迁移历史。', '请核对当前分支、drizzle/meta/_journal.json 和已提交的 SQL 文件；可只读执行 SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at; 对照历史。不要直接删除迁移历史或重跑已执行的 SQL。'],
  DB_MIGRATION_HISTORY_GAP: ['迁移历史存在缺口：某个未执行迁移的时间不晚于数据库最新迁移，Drizzle 会跳过它。', '请核对分支、迁移日志时间和数据库历史，恢复一致的迁移链后再执行。'],
  DB_MIGRATION_REQUIRED: ['数据库还有未执行的本地迁移。', '请先执行 npm run db:migrate。'],
  DB_MIGRATION_BUSY: ['同一数据库已有迁移在执行，本次未开始写入。请等待该迁移结束后重试。'],
  DB_BASELINE_INVALID: ['数据库基线核验未通过。请查看上方 failures 列表，核对结构、引用、摘要及发布投影；不要通过删库或删除迁移凭据绕过检查。'],
  DB_INTERACTIVE_TERMINAL_REQUIRED: ['此写入操作需要交互终端确认库名。请在终端中执行，勿使用输入输出重定向。'],
  DB_CONNECTION_INVALID: ['数据库连接配置缺失或格式不正确。请检查对应的连接变量，使用 mysql:// 协议并指定库名。'],
  DB_MIGRATION_TARGET_MISMATCH: ['迁移连接与运行连接的主机、端口或库名不一致。请核对 DATABASE_MIGRATION_URL 和 NUXT_DATABASE_URL。'],
  DB_IDENTITY_OR_PROPERTIES_MISMATCH: ['实际连接的库名或字符集不符合要求。'],
  DB_CANCELLED: ['输入的确认库名不匹配，操作已取消。'],
}

export function formatDatabaseError(error, validation = undefined) {
  let code = /^DB_[A-Z_]+$/.test(error?.message ?? '') ? error.message : 'DB_OPERATION_FAILED'
  const details = []
  // validation 由 CLI 对 ApiError 做 instanceof 核验后提供；不输出任意异常消息。
  if (validation?.code === 'INVALID_INPUT') {
    code = 'DB_INPUT_INVALID'
    for (const field of validation.fields ?? []) {
      if (field.path === 'password' && field.message === '密码不能使用已知弱口令') code = 'DB_PASSWORD_BLOCKED'
      else if (field.path === 'password' && /^密码须为 \d{1,3}–\d{1,3} 个字符$/.test(field.message)) {
        code = 'DB_PASSWORD_LENGTH_INVALID'
        details.push(field.message)
      } else if (/^[a-zA-Z][a-zA-Z0-9_.]{0,159}$/.test(field.path)) details.push(`校验失败字段：${field.path}`)
    }
  }
  if (['SYSTEM_SEED_ROOT_REQUIRED', 'SYSTEM_SEED_PASSWORD_REQUIRED', 'SYSTEM_SEED_ROLE_DISABLED'].includes(error?.message)) code = `DB_${error.message}`
  const driverCode = safeDatabaseErrorCode(error)
  const lines = [`[DB] 未完成 ${code}${driverCode ? ` (${driverCode})` : ''}`]
  lines.push(...(databaseErrorHints[code] ?? ['请使用 npm run db -- --help 核对命令；检查目标环境、连接配置及初始化前置条件。']).map(line => `  ${line}`))
  lines.push(...details.map(line => `  ${line}`))
  if (code === 'DB_MIGRATION_HISTORY_UNKNOWN' && Array.isArray(error.migrationDetails)) {
    lines.push(`  不匹配记录共 ${error.migrationCount} 条（最多显示 10 条；created_at 为迁移时间戳）：`)
    for (const row of error.migrationDetails) lines.push(`    hash=${row.hash}, created_at=${row.createdAt}`)
  }
  return lines.join('\n')
}
