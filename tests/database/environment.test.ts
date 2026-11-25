import {setRolePermissions, setRoleMenus} from './authorization-fixture'
import {createServer, type Server} from 'node:http'
import type {AddressInfo} from 'node:net'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {createApp, createRouter, defineEventHandler, toNodeListener} from 'h3'
import {eq} from 'drizzle-orm'
import {setupTestDatabase, cleanTestDatabase} from './support'
import {seedRoot} from '../../scripts/database/seed/system'
import {createAccountService} from '../../server/services/accounts'
import {createRbacService} from '../../server/services/rbac'
import {createRoleService} from '../../server/services/roles'
import {createMenuService} from '../../server/services/menus'
import {createAuthService} from '../../server/services/auth'
import {createEnvironmentService} from '../../server/services/environment'
import {environmentHandlers} from '../../server/http/handlers/environment-handlers'
import {guardAdminRequest, SESSION_COOKIE} from '../../server/http/auth'
import {ensureRequestId} from '../../server/http/request-id'
import {apiErrorResponse} from '../../server/http/handler'
import {adminUsers, adminUserRoles, adminOperationLogs, adminMenus} from '../../server/db/schema'
import {rolePresets} from '../../scripts/database/seed/samples'

let client: Awaited<ReturnType<typeof setupTestDatabase>>, server: Server, root: bigint, reader: bigint, empty: bigint
let role: string, token: string, emptyToken: string, base: string
const password = 'Environment fixture Aurora 8462!'
const meta = {ip: '127.0.0.1', userAgent: 'environment-fixture', requestId: '00000000-0000-4000-8000-000000000001'}
const options = {origin: 'http://environment.test', secureCookie: false}
beforeAll(async () => {
    client = await setupTestDatabase()
    root = BigInt((await seedRoot(client.database, password)).id)
    const accounts = createAccountService(client.database, false)
    reader = BigInt((await accounts.createOrdinary({username: 'environment_reader', displayName: 'Reader', password}, String(root))).id)
    empty = BigInt((await accounts.createOrdinary({username: 'environment_empty', displayName: 'Empty', password}, String(root))).id)
    await client.database.update(adminUsers).set({mustChangePassword: false})
    const rbac = createRbacService(client.database); await rbac.sync()
    const roles = createRoleService(client.database)
    role = (await roles.create(root, {code: 'environment_reader', name: '环境查看', enabled: true}, meta)).id
    await setRolePermissions(client.database, root, role, {version: 1, permissions: ['system.environment.read']}, meta)
    await client.database.insert(adminUserRoles).values({userId: reader, roleId: BigInt(role)})
    const auth = createAuthService(client.database, undefined, false)
    const login = async (username: string) => { const state = await auth.bootstrap(undefined, meta); return (await auth.login(state.raw, username, password, meta)).raw }
    token = await login('environment_reader'); emptyToken = await login('environment_empty')
    const app = createApp(), router = createRouter(), handler = environmentHandlers(client.database)
    app.use(defineEventHandler(async event => {
        ensureRequestId(event)
        try { await guardAdminRequest(event, auth, options, rbac.authorize) } catch (error) { return apiErrorResponse(event, error) }
    }))
    router.get('/api/admin/environment', handler.overview); app.use(router)
    server = createServer(toNodeListener(app))
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(async () => {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()))
    if (client) await cleanTestDatabase(client)
})
const request = (suffix = '', cookie = token) => fetch(base + '/api/admin/environment' + suffix, {headers: cookie ? {Cookie: `${SESSION_COOKIE}=${cookie}`} : {}})

describe('系统环境纵向接入', () => {
    it('同步只补菜单，保留已有布局，普通角色不自动获得权限', async () => {
        const menus = createMenuService(client.database)
        const [row] = await client.database.select().from(adminMenus).where(eq(adminMenus.code, 'system_environment'))
        expect(row).toMatchObject({name: '系统环境', pageKey: 'environment', sortOrder: 400})
        const [parent] = await client.database.select().from(adminMenus).where(eq(adminMenus.id, row!.parentId!))
        expect(parent?.code).toBe('system_config')
        expect((await menus.navigation(root)).items.some(item => item.path === '/admin/environment')).toBe(true)
        expect((await menus.navigation(empty)).items.some(item => item.path === '/admin/environment')).toBe(false)
        await setRoleMenus(client.database, root, role, {version: 2, menuIds: [String(row!.id)]}, meta)
        expect((await menus.navigation(reader)).items.some(item => item.path === '/admin/environment')).toBe(true)
        expect(rolePresets.every(item => !(item.permissions as readonly string[]).includes('system.environment.read'))).toBe(true)
        await client.database.update(adminMenus).set({name: '自定义环境入口', sortOrder: 888}).where(eq(adminMenus.id, row!.id))
        await createRbacService(client.database).sync()
        expect((await client.database.select().from(adminMenus).where(eq(adminMenus.id, row!.id)))[0]).toMatchObject({name: '自定义环境入口', sortOrder: 888})
    })
    it('接口拒绝匿名、无权限和额外参数，成功只返回受控字段且不写操作审计', async () => {
        expect((await request('', '')).status).toBe(401)
        expect((await request('', emptyToken)).status).toBe(403)
        expect((await request('?command=anything')).status).toBe(400)
        const before = (await client.database.select().from(adminOperationLogs)).length
        const response = await request()
        expect(response.status).toBe(200)
        expect(response.headers.get('cache-control')).toContain('no-store')
        const {data} = await response.json()
        expect(Object.keys(data).sort()).toEqual(['application', 'cpu', 'instanceId', 'memory', 'sampledAt', 'scope', 'system'])
        expect(data.scope).toBe('os-visible')
        expect(data.application.rssBytes).toBeGreaterThan(0)
        expect(data.memory.occupiedBytes).toBeGreaterThanOrEqual(0)
        expect(JSON.stringify(data)).not.toMatch(/DATABASE_URL|password|execPath|hostname|cwd/)
        expect((await client.database.select().from(adminOperationLogs)).length).toBe(before)
    })
    it('同一会话撤权立即生效；服务层也独立校验', async () => {
        const service = createEnvironmentService(client.database)
        await expect(service.overview(empty)).rejects.toMatchObject({code: 'FORBIDDEN'})
        await setRolePermissions(client.database, root, role, {version: 3, permissions: []}, meta)
        expect((await request()).status).toBe(403)
        await expect(service.overview(reader)).rejects.toMatchObject({code: 'FORBIDDEN'})
    })
})
