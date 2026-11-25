// 虚构连接与临时环境文件验证选库边界；CLI 拒绝路径不得连接数据库。
import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseDatabaseCommand, loadDatabaseEnvironment, resolveDatabaseTarget, normalizeGeneratedJournal, inspectMigrationHistory, requireMigrationState, safeDatabaseErrorCode, formatDatabaseError } from '../../scripts/lib/database.mjs'

const env = { NODE_ENV: 'test', NUXT_DATABASE_URL: 'mysql://app:fixture@localhost/studwell_dev', DATABASE_MIGRATION_URL: 'mysql://migration:fixture@127.0.0.1/studwell_dev', TEST_DATABASE_URL: 'mysql://test:fixture@localhost/studwell_test', TEST_DATABASE_NAME: 'studwell_test' }
describe('数据库统一命令',()=>{
 it.each(['init','site','samples','migrate','check','generate','sync:rbac'])('%s 直接使用本站连接',action=>{
  expect(parseDatabaseCommand([action])).toMatchObject({action,dryRun:false})
 })
 it.each(['init','site','samples','migrate','sync:rbac'])('%s 支持只读预览',action=>{
  expect(parseDatabaseCommand([action,'--dry-run'])).toMatchObject({dryRun:true})
 })
 it('初始化支持媒体目录，拒绝已移除的内容包命令与参数',()=>{
  expect(parseDatabaseCommand(['site','--media-root','media'])).toMatchObject({mediaRoot:'media'})
  for(const args of [['import'],['export'],['init','--input','package'],['init','--output','package'],['init','--type','pages'],['samples','--media-root','media'],['site','--media-root',''],['init','--media-root','media'],['check','--dry-run']])expect(()=>parseDatabaseCommand(args)).toThrow()
 })
 it('不兼容旧命令、环境选择及应用开关',()=>{
  for(const args of [['import','website'],['export','published'],['sync','rbac'],['seed','root'],['seed','presets'],['seed','mock'],['reset','test','data'],['check','--target','dev'],['init','--bundle','a'],['samples','--apply']])expect(()=>parseDatabaseCommand(args)).toThrow()
 })
 it('迁移账号必须与运行连接指向同一库，不能使用测试库',()=>{
  expect(resolveDatabaseTarget({action:'check'},env).url).toBe(env.NUXT_DATABASE_URL)
  expect(resolveDatabaseTarget({action:'migrate'},env).url).toBe(env.DATABASE_MIGRATION_URL)
  expect(()=>resolveDatabaseTarget({action:'check'},{...env,NUXT_DATABASE_URL:env.TEST_DATABASE_URL})).toThrow('DB_TEST_DATABASE_FORBIDDEN')
  for(const url of ['mysql://migration:fixture@localhost/other_dev','mysql://migration:fixture@other-host/sinocem_dev','mysql://migration:fixture@localhost:3307/sinocem_dev'])expect(()=>resolveDatabaseTarget({action:'migrate'},{...env,DATABASE_MIGRATION_URL:url})).toThrow('DB_MIGRATION_TARGET_MISMATCH')
 })
 it('仅加载本站配置与进程覆盖，不读取测试环境文件',()=>{
  const folder=mkdtempSync(join(tmpdir(),'site-db-command-')),root=pathToFileURL(folder+'/')
  try{
   writeFileSync(join(folder,'.env'),'NUXT_DATABASE_URL=local-value\n')
   writeFileSync(join(folder,'.env.test'),'NUXT_DATABASE_URL=test-value\n')
   expect(loadDatabaseEnvironment(root,{}).NUXT_DATABASE_URL).toBe('local-value')
   expect(loadDatabaseEnvironment(root,{NUXT_DATABASE_URL:'shell-value'}).NUXT_DATABASE_URL).toBe('shell-value')
  }finally{unlinkSync(join(folder,'.env'));unlinkSync(join(folder,'.env.test'));rmdirSync(folder)}
 })
 it('真实 CLI 不再要求 target 或 apply，非交互写入在连接前拒绝',()=>{
  const options={env:{...process.env,...env},encoding:'utf8' as const,stdio:'pipe' as const}
  const help=execFileSync(process.execPath,['scripts/database.mjs','--help'],options)
  expect(help).not.toContain('--target');expect(help).not.toContain('--apply');expect(help).toContain('--dry-run');expect(help).not.toMatch(/db:import|db:export|--input|--type/)
  for(const args of [['init'],['site'],['migrate'],['samples']]){
   try{execFileSync(process.execPath,['scripts/database.mjs',...args],options);expect.fail('CLI应拒绝执行')}
   catch(error){const failure=error as {stderr:string;status:number};expect(failure.status).toBe(1);expect(failure.stderr).toContain('DB_INTERACTIVE_TERMINAL_REQUIRED');expect(failure.stderr).not.toContain('mysql://');expect(failure.stderr).not.toContain('fixture')}
  }
 })
})

describe('迁移时钟与遗漏保护',()=>{
 it('CLI区分密码长度、弱口令、确认不一致及其他输入错误且不回显任意消息',()=>{
   const error = new Error('内部信息不能输出')
   expect(formatDatabaseError(error,{code:'INVALID_INPUT',fields:[{path:'password',message:'密码须为 6–128 个字符'}]})).toContain('密码须为 6–128 个字符')
   expect(formatDatabaseError(error,{code:'INVALID_INPUT',fields:[{path:'password',message:'密码不能使用已知弱口令'}]})).toContain('DB_PASSWORD_BLOCKED')
   expect(formatDatabaseError(new Error('DB_PASSWORD_CONFIRMATION_FAILED'))).toContain('两次输入的密码不一致')
   const output = formatDatabaseError(error,{code:'INVALID_INPUT',fields:[{path:'displayName',message:'secret-input'}]})
   expect(output).toContain('校验失败字段：displayName')
   expect(output).not.toMatch(/secret-input|内部信息/)
   expect(formatDatabaseError(new Error('SYSTEM_SEED_ROLE_DISABLED'))).toContain('预设角色未启用')
 })
 it('未知历史输出具体凭据、原因和排查建议，限制数量且过滤异常内容',()=>{
   const rows = Array.from({length:12}, (_, index)=>({hash:index === 0 ? 'mysql://secret\npassword' : 'a'.repeat(64),created_at:index === 0 ? 'secret' : 123}))
   try {
     inspectMigrationHistory([],rows)
     expect.fail('应拒绝未知历史')
   } catch(error) {
     const output = formatDatabaseError(error)
     expect(output).toContain('DB_MIGRATION_HISTORY_UNKNOWN')
     expect(output).toContain('共 12 条')
     expect(output).toContain('a'.repeat(64))
     expect(output).toContain('created_at=123')
     expect(output).toContain('当前分支')
     expect(output).toContain('SELECT hash, created_at')
     expect(output.match(/    hash=/g)).toHaveLength(10)
     expect(output).not.toContain('secret')
   }
 })
 it('底层错误仅输出安全错误码，不输出连接、SQL和堆栈',()=>{
   const output = formatDatabaseError(new Error('mysql://secret', {cause:{code:'ER_ACCESS_DENIED_ERROR',sql:'sensitive query'}}))
   expect(output).toContain('ER_ACCESS_DENIED_ERROR')
   expect(output).not.toMatch(/secret|sensitive query|Error:/)
   expect(formatDatabaseError(new Error('DB_MIGRATION_BUSY'))).toContain('已有迁移在执行')
   expect(formatDatabaseError(new Error('DB_BASELINE_INVALID'))).toContain('failures')
 })
 it('新迁移时钟回拨仍严格递增，旧记录不改写',()=>{const previous=[{idx:0,tag:'0000_first',when:100}];expect(normalizeGeneratedJournal(previous,[...previous,{idx:1,tag:'0001_next',when:50}])[1].when).toBe(101);expect(()=>normalizeGeneratedJournal(previous,[{...previous[0],when:99}])).toThrow('DB_MIGRATION_HISTORY_REWRITTEN')})
 it('历史缺口必须明确拒绝',()=>{const manifest=[{tag:'0000_first',when:10,hash:'a'},{tag:'0001_next',when:20,hash:'b'}];expect(()=>requireMigrationState(inspectMigrationHistory(manifest,[{hash:'b',created_at:20}]),true)).toThrow('DB_MIGRATION_HISTORY_GAP')})
 it('未知凭据拒绝，不泄露底层SQL',()=>{expect(()=>inspectMigrationHistory([],[{hash:'unknown',created_at:20}])).toThrow('DB_MIGRATION_HISTORY_UNKNOWN');expect(safeDatabaseErrorCode({cause:{code:'ER_NO_SUCH_TABLE',sql:'secret'}})).toBe('ER_NO_SUCH_TABLE')})
 it('完整凭据不依赖记录插入顺序，全部识别为已应用',()=>{const manifest=[{tag:'0022_log_changes',when:10,hash:'a'},{tag:'0023_entity_ids',when:20,hash:'b'}];expect(inspectMigrationHistory(manifest,[{hash:'b',created_at:20},{hash:'a',created_at:10}]).every(row=>row.status==='applied')).toBe(true)})
})

it('旧模板同步和删除命令已移除，统一使用后台维护',()=>{
 expect(()=>parseDatabaseCommand(['sync','templates'])).toThrow('DB_COMMAND_INVALID')
 expect(()=>parseDatabaseCommand(['remove','template'])).toThrow('DB_COMMAND_INVALID')
 expect(()=>parseDatabaseCommand(['check','--target','test','--key','home.hero'])).toThrow()
})
