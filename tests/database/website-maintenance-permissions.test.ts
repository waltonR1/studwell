// 真实数据库验证页面、语言和路由的授权互不替代，同步不自动扩展旧角色。
import {afterAll,beforeAll,expect,it} from 'vitest'
import {eq} from 'drizzle-orm'
import {setupTestDatabase,cleanTestDatabase} from './support'
import {seedRoot} from '../../scripts/database/seed/system'
import {createAccountService} from '../../server/services/accounts'
import {createRbacService} from '../../server/services/rbac'
import {adminUsers,adminRoles,adminPermissions,adminRolePermissions,adminUserRoles} from '../../server/db/schema'
import {withEntityIds} from '../../server/db/allocate-entity-id'
import {getPermissionSnapshot} from '../../server/services/access/permissions'
import {validateRoleAuthorization} from '../../server/policies/role-authorization'
import {readSiteLanguageState,saveSiteLanguageDraft,publishSiteLanguages} from '../../server/services/site-language-maintenance'
import {readWebsiteRouteTree,mutateWebsiteRouteNode,publishWebsiteRouteTree} from '../../server/services/website-route-tree'
import {defaultSiteLanguages} from '../../shared/config/site-languages'
import {menuPageCatalog} from '../../server/config/menus'
let client:Awaited<ReturnType<typeof setupTestDatabase>>,actor:bigint,user:bigint,role:bigint
const meta={ip:'local',userAgent:'website-maintenance-permissions',requestId:'00000000-0000-4000-8000-000000000001'}
const groups=['content.site_languages','content.routes']
const operations=['read','update','publish'] as const
const routes=[['GET','/api/admin/site-languages'],['PUT','/api/admin/site-languages'],['POST','/api/admin/site-languages/publish'],['GET','/api/admin/website-routes'],['PUT','/api/admin/website-routes'],['POST','/api/admin/website-routes/publish']]
async function grant(codes:string[]){await client.database.delete(adminRolePermissions).where(eq(adminRolePermissions.roleId,role));const all=await client.database.select().from(adminPermissions);const permissions=all.filter(row=>codes.includes(row.code));if(permissions.length)await client.database.insert(adminRolePermissions).values(permissions.map(row=>({roleId:role,permissionId:row.id})))}
beforeAll(async()=>{client=await setupTestDatabase();actor=BigInt((await seedRoot(client.database,'Permission fixture Aurora 8462!')).id);user=BigInt((await createAccountService(client.database,false).createOrdinary({username:'maintenance_member',displayName:'维护账号',password:'Permission member Aurora 8462!'},String(actor))).id);await client.database.update(adminUsers).set({mustChangePassword:false});await createRbacService(client.database).sync();const row=await withEntityIds(client.database,'admin_roles',{code:'page_permissions_only',name:'仅网页权限'});await client.database.insert(adminRoles).values(row);role=row.id;await client.database.insert(adminUserRoles).values({userId:user,roleId:role})})
afterAll(async()=>{if(client)await cleanTestDatabase(client)})
it('权限目录、菜单操作与角色依赖采用独立模块权限',async()=>{
 const all=await client.database.select().from(adminPermissions)
 expect(all.map(row=>row.code)).toEqual(expect.arrayContaining(groups.flatMap(group=>operations.map(op=>group+'.'+op))))
 for(const [index,key]of ['site_languages','website_routes'].entries()){
  const page=menuPageCatalog.find(item=>item.key===key)!
  expect(page.permission).toBe(groups[index]+'.read')
  expect(page.operations).toEqual(operations.map(op=>groups[index]+'.'+op))
  const rows=[{id:1n,pageKey:key}]
  expect(()=>validateRoleAuthorization(['content.pages.read','content.pages.update','content.pages.publish'],['1'],rows)).toThrow()
  expect(()=>validateRoleAuthorization(operations.map(op=>groups[index]+'.'+op),['1'],rows)).not.toThrow()
 }
})
it('旧网页角色及目录同步不能获得语言和路由接口权限',async()=>{
 const old=operations.map(op=>'content.pages.'+op)
 await grant(old)
 await createRbacService(client.database).sync()
 const snapshot=await getPermissionSnapshot(client.database,user)
 expect(snapshot.permissions).toEqual(expect.arrayContaining(old))
 expect(snapshot.permissions.some(code=>groups.some(group=>code.startsWith(group+'.')))).toBe(false)
 for(const [method,path]of routes)await expect(createRbacService(client.database).authorize(user,method!,path!)).rejects.toMatchObject({code:'FORBIDDEN'})
 await expect(readSiteLanguageState(client.database,user)).rejects.toMatchObject({code:'FORBIDDEN'})
 await expect(readWebsiteRouteTree(client.database,user)).rejects.toMatchObject({code:'FORBIDDEN'})
})
it('语言和路由操作权限彼此独立，写入不能由读取权限替代',async()=>{
 const rbac=createRbacService(client.database)
 for(const [index,group]of groups.entries()){
  await grant([group+'.read'])
  await expect(rbac.authorize(user,'GET',routes[index*3]![1]!)).resolves.toBeUndefined()
  for(const [n,[method,path]]of routes.entries())if(n!==index*3)await expect(rbac.authorize(user,method!,path!)).rejects.toMatchObject({code:'FORBIDDEN'})
  await grant(operations.map(op=>group+'.'+op))
  for(const [n,[method,path]]of routes.entries())if(Math.floor(n/3)===index)await expect(rbac.authorize(user,method!,path!)).resolves.toBeUndefined();else await expect(rbac.authorize(user,method!,path!)).rejects.toMatchObject({code:'FORBIDDEN'})
 }
})
it('独立权限不取消 Root 限制；Root 使用新目录完成维护',async()=>{
 await grant(groups.flatMap(group=>operations.map(op=>group+'.'+op)))
 await expect(readSiteLanguageState(client.database,user)).rejects.toMatchObject({code:'FORBIDDEN'})
 await expect(saveSiteLanguageDraft(client.database,user,{version:1,languages:defaultSiteLanguages},meta)).rejects.toMatchObject({code:'FORBIDDEN'})
 await expect(publishSiteLanguages(client.database,user,{version:1,publishedReleaseId:null},meta)).rejects.toMatchObject({code:'FORBIDDEN'})
 await expect(readWebsiteRouteTree(client.database,user)).rejects.toMatchObject({code:'FORBIDDEN'})
 await expect(mutateWebsiteRouteNode(client.database,user,{action:'delete',version:1,id:'1'},meta)).rejects.toMatchObject({code:'FORBIDDEN'})
 await expect(publishWebsiteRouteTree(client.database,user,{version:1,publishedReleaseId:null},meta)).rejects.toMatchObject({code:'FORBIDDEN'})
 const language=await readSiteLanguageState(client.database,actor)
 const saved=await saveSiteLanguageDraft(client.database,actor,{version:language.version,languages:language.languages},meta)
 await expect(publishSiteLanguages(client.database,actor,{version:saved.version,publishedReleaseId:saved.publishedReleaseId},meta)).resolves.toMatchObject({version:saved.version+1})
 const route=await readWebsiteRouteTree(client.database,actor)
 await expect(publishWebsiteRouteTree(client.database,actor,{version:route.version,publishedReleaseId:route.publishedReleaseId},meta)).resolves.toMatchObject({version:route.version+1})
})
