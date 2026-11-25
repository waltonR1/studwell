// 本站数据库工具；只编排流程，具体写入由迁移和种子模块负责。
import {fileURLToPath} from 'node:url'
import {resolve} from 'node:path'
import {spawnSync} from 'node:child_process'
import {createInterface} from 'node:readline/promises'
import {Writable} from 'node:stream'
import {readFileSync} from 'node:fs'
import {createJiti} from 'jiti'
import {parseDatabaseCommand,loadDatabaseEnvironment,resolveDatabaseTarget,readMigrationManifest,finishGeneratedJournal,readMigrationHistory,requireMigrationState,formatDatabaseError} from './lib/database.mjs'

const root=new URL('../',import.meta.url)
const help=[
'数据库命令：',
'  npm run db:init                  # 表结构 → 系统数据与 Root',
'  npm run db:site                  # 本站配置、页面与业务内容',
'  npm run db:samples               # 可选展示样例',
'  npm run db:migrate               # 已有库升级',
'  npm run db:check                 # 只读核验',
'  npm run db:generate              # 生成 SQL',
'  npm run db:sync:rbac             # 同步权限菜单',
'',
'预览：支持预览的写入命令追加 --dry-run，不写数据库或文件、不询问密码。',
'db:site 媒体目录默认读取本站配置，可用 --media-root DIR 覆盖。',
'数据库写入前需交互确认实际目标库名。',
'数据库自动化测试：npm run test:db。'].join('\n')

async function question(label,hidden=false){
  const output=hidden?new Writable({write(_chunk,_encoding,done){done()}}):process.stdout
  const prompt=createInterface({input:process.stdin,output,terminal:true})
  if(hidden)process.stdout.write(label)
  try{return await prompt.question(hidden?'':label)}finally{prompt.close();if(hidden)process.stdout.write('\n')}
}
async function password(label){
  const value=await question(label+'（不回显）：',true)
  if(value!==await question('再次输入：',true))throw new Error('DB_PASSWORD_CONFIRMATION_FAILED')
  return value
}
async function samples(jiti,db,dryRun=false){
  const {seedSamples,sampleAccounts}=await jiti.import('./database/seed/samples.ts')
  if(dryRun)return seedSamples(db,undefined,true)
  await seedSamples(db,undefined,true)
  const {adminUsers}=await jiti.import('../server/db/schema.ts')
  const users=await db.select({username:adminUsers.username}).from(adminUsers)
  const initial=sampleAccounts.some(account=>!users.some(user=>user.username===account.username))?await password('新增示例账号初始密码'):undefined
  return seedSamples(db,initial)
}

let client,ApiError
try{
  const command=parseDatabaseCommand(process.argv.slice(2))
  if(command.action==='help')console.log(help)
  else if(command.action==='generate'){
    const folder=fileURLToPath(new URL('drizzle',root))
    readMigrationManifest(folder)
    const previous=JSON.parse(readFileSync(folder+'/meta/_journal.json','utf8')).entries
    const result=spawnSync(process.execPath,[fileURLToPath(new URL('node_modules/drizzle-kit/bin.cjs',root)),'generate'],{cwd:fileURLToPath(root),stdio:'inherit'})
    if(result.error||result.status!==0)throw new Error('DB_GENERATE_FAILED')
    finishGeneratedJournal(folder,previous)
  }else{
    const writing=!command.dryRun&&command.action!=='check'
    if(writing&&(!process.stdin.isTTY||!process.stdout.isTTY))throw new Error('DB_INTERACTIVE_TERMINAL_REQUIRED')
    const jiti=createJiti(import.meta.url,{alias:{'#shared':fileURLToPath(new URL('shared/',root)),'#section-renderer-inventory':fileURLToPath(new URL('scripts/build-section-renderer-inventory.ts',root))}})
    ;({ApiError}=await jiti.import('../server/core/errors.ts'))
    const env=loadDatabaseEnvironment(root),target=resolveDatabaseTarget(command,env)
    const migrationTarget=command.action==='init'?resolveDatabaseTarget({action:'migrate'},env):target
    const mediaRoot=resolve(fileURLToPath(root),command.mediaRoot||env.NUXT_MEDIA_STORAGE_PATH||'public')
    const siteSeed=command.action==='site'?await jiti.import('./database/seed/site.ts'):null
    const {createDatabaseClient}=await jiti.import('../server/db/client.ts')
    client=createDatabaseClient(target.url)
    const [[identity]]=await client.pool.query('SELECT DATABASE() AS name,@@character_set_database AS charset')
    if(identity.name!==target.name||identity.charset!=='utf8mb4')throw new Error('DB_IDENTITY_OR_PROPERTIES_MISMATCH')
    console.log('[DB] 当前数据库：'+identity.name)
    const manifest=readMigrationManifest(fileURLToPath(new URL('drizzle',root)))
    const state=await readMigrationHistory(client.pool,manifest)
    requireMigrationState(state,['init','migrate','check'].includes(command.action))
    const ready=state.every(item=>item.status==='applied')
    if(command.action==='init')console.log('[DB] 系统安装计划',{migrations:state.filter(item=>item.status!=='applied').map(item=>item.tag),system:'必要系统数据与 Root'})
    if(command.action==='site'){
      const {adminUsers,adminParameters,adminTasks,customerInquirySettings,websiteSiteConfig,websiteLanguageConfig}=await jiti.import('../server/db/schema.ts')
      const roots=await client.database.select().from(adminUsers)
      const rootAccount=roots.find(row=>row.username==='root')
      if(!rootAccount?.isRoot||!rootAccount.enabled||rootAccount.deletedAt)throw new Error('DB_SYSTEM_INIT_REQUIRED')
      const {parameterSeedDefaults,taskSeedDefaults}=await jiti.import('./database/seed/system.ts')
      const parameters=await client.database.select({key:adminParameters.key}).from(adminParameters),tasks=await client.database.select({code:adminTasks.code}).from(adminTasks)
      if(Object.keys(parameterSeedDefaults).some(key=>!parameters.some(row=>row.key===key))||Object.keys(taskSeedDefaults).some(code=>!tasks.some(row=>row.code===code)))throw new Error('DB_SYSTEM_INIT_REQUIRED')
      for(const table of [customerInquirySettings,websiteSiteConfig,websiteLanguageConfig])if(!(await client.database.select().from(table)).some(row=>row.id===1))throw new Error('DB_SYSTEM_INIT_REQUIRED')
      const content=await siteSeed.inspectSiteContent(client.database)
      console.log('[DB] 本站安装计划',{content:'本站内置内容',pages:content.pages,status:content.status})
    }
    if(command.action==='samples'&&!command.dryRun)console.log('[DB] 样例计划',await samples(jiti,client.database,true))
    if(writing&&await question('请输入目标库名 '+target.name+' 确认：')!==target.name)throw new Error('DB_CANCELLED')

    if(command.action==='check'){
      console.log('[DB] 迁移状态',state)
      if(ready){const {checkDatabaseBaseline}=await jiti.import('./database/baseline.ts');const result=await checkDatabaseBaseline(client);console.log(result);if(!result.ok)throw new Error('DB_BASELINE_INVALID')}
    }else if(command.action==='init'){
      if(command.dryRun)console.log('[DB] 仅预览，未建表、未填数据、未询问密码。'+(ready?'':'目标尚未完成迁移，结构相关的目标校验需迁移后执行。'))
      else{
        const {migrateDatabase}=await import('./lib/database-migrations.mjs')
        const migrationClient=migrationTarget.url===target.url?client:createDatabaseClient(migrationTarget.url)
        try{await migrateDatabase(migrationClient,fileURLToPath(new URL('drizzle',root)))}finally{if(migrationClient!==client)await migrationClient.pool.end()}
        console.log('[DB 1/2] 表结构已就绪')
        const {seedSystemData,seedRoot}=await jiti.import('./database/seed/system.ts')
        const {accountRepository}=await jiti.import('../server/repositories/accounts.ts')
        await seedSystemData(client.database)
        const rootAccount=await accountRepository.findByUsername(client.database,'root')
        await seedRoot(client.database,rootAccount?undefined:await password('Root 初始密码'))
        console.log('[DB 2/2] 必要系统数据与 Root 已就绪')
        console.log('[DB] 系统初始化完成；新 Root 首次登录仍须改密。本站内容请单独运行 npm run db:site。')
      }
    }else if(command.action==='site'){
      if(command.dryRun)console.log('[DB] 仅预览本站安装，未写入数据库或文件。')
      else{
        console.log('[DB] 本站内容',await siteSeed.seedSiteContent(client.database,{mediaRoot}))
        const {checkDatabaseBaseline}=await jiti.import('./database/baseline.ts')
        const result=await checkDatabaseBaseline(client)
        if(!result.ok){console.log(result);throw new Error('DB_BASELINE_INVALID')}
        console.log('[DB] 本站初始化完成；展示样例可按需运行 npm run db:samples。')
      }
    }else if(command.action==='migrate'){
      if(command.dryRun)console.log('[DB] 待执行迁移',state.filter(item=>item.status!=='applied'))
      else{const {migrateDatabase}=await import('./lib/database-migrations.mjs');await migrateDatabase(client,fileURLToPath(new URL('drizzle',root)));console.log('[DB] 迁移完成')}
    }else if(command.action==='samples')console.log('[DB] 样例',await samples(jiti,client.database,command.dryRun))
    else if(command.action==='sync:rbac'){
      if(command.dryRun){const {permissionCatalog}=await jiti.import('../server/config/permissions.ts');console.log('[DB] 将按代码目录同步权限和菜单，权限目录共 '+permissionCatalog.length+' 项；未写入')}
      else{const {createRbacService}=await jiti.import('../server/services/rbac.ts');console.log('[DB] 权限菜单',await createRbacService(client.database).sync())}
    }
  }
}catch(error){
  console.error(formatDatabaseError(error,ApiError&&error instanceof ApiError?error:undefined))
  process.exitCode=1
}finally{await client?.pool.end()}
