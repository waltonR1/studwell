import {withEntityIds} from '../../server/db/allocate-entity-id'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {eq} from 'drizzle-orm'
import {setupTestDatabase, cleanTestDatabase} from './support'
import {MAX_ENTITY_VERSION, MAX_WRITABLE_ENTITY_VERSION} from '../../shared/config/entity-versions'
import {adminUsers, adminTasks, adminRoles, adminMenus, adminDictionaries, adminParameters} from '../../server/db/schema'
import {seedRoot} from '../../scripts/database/seed/system'
import {createAccountService} from '../../server/services/accounts'
import {accountRepository} from '../../server/repositories/accounts'
import {authRepository} from '../../server/repositories/auth'
import {roleRepository} from '../../server/repositories/roles'
import {menuRepository} from '../../server/repositories/menus'
import {dictionaryRepository} from '../../server/repositories/dictionaries'
import {parameterRepository} from '../../server/repositories/parameters'
import {taskRepository} from '../../server/repositories/tasks'
import {createTaskService} from '../../server/services/tasks'

let client: Awaited<ReturnType<typeof setupTestDatabase>>, actor: bigint
const meta = {ip: 'local', userAgent: 'version-fixture', requestId: '00000000-0000-4000-8000-000000000001'}
beforeAll(async () => {
    client = await setupTestDatabase()
    actor = BigInt((await seedRoot(client.database, 'Version fixture Aurora 8462!')).id)
    await client.database.update(adminUsers).set({mustChangePassword: false}).where(eq(adminUsers.id, actor))
})
afterAll(async () => { if (client) await cleanTestDatabase(client) })

describe('uint32 版本写入边界', () => {
    it('任务最后一次合法更新到达 uint32 上限，后续请求拒绝且不修改状态', async () => {
        const task = (await taskRepository.byCode(client.database, 'auth_cleanup'))!
        await client.database.update(adminTasks).set({version: MAX_WRITABLE_ENTITY_VERSION}).where(eq(adminTasks.id, task.id))
        const service = createTaskService(client.database, {executionAllowed: false})
        await service.update(actor, String(task.id), {version: MAX_WRITABLE_ENTITY_VERSION, schedule: {mode: 'interval', minutes: 30}, retention: null}, meta)
        expect(await taskRepository.task(client.database, task.id)).toMatchObject({version: MAX_ENTITY_VERSION, schedule: {mode: 'interval', minutes: 30}})
        await expect(service.status(actor, String(task.id), {version: MAX_ENTITY_VERSION, enabled: false}, meta)).rejects.toMatchObject({code: 'INVALID_INPUT'})
        await expect(service.run(actor, String(task.id), {version: MAX_ENTITY_VERSION, confirmed: true}, meta)).rejects.toMatchObject({code: 'INVALID_INPUT'})
        expect(await taskRepository.task(client.database, task.id)).toMatchObject({version: MAX_ENTITY_VERSION, enabled: task.enabled, activeRunId: null})
        expect(await taskRepository.updateConfiguration(client.database, task.id, MAX_ENTITY_VERSION, {enabled: false})).toBe(false)
    })
    it('账号和认证仓储在版本耗尽时不溢出、不覆盖资料或密码', async () => {
        const user = await createAccountService(client.database, false).createOrdinary({username: 'version_fixture', displayName: 'Before', password: 'Version fixture Aurora 8462!'}, String(actor))
        const id = BigInt(user.id)
        await client.database.update(adminUsers).set({version: MAX_WRITABLE_ENTITY_VERSION}).where(eq(adminUsers.id, id))
        expect(await accountRepository.updateOrdinary(client.database, id, MAX_WRITABLE_ENTITY_VERSION, actor, {displayName: 'Last update'})).toBe(true)
        const before = (await accountRepository.findById(client.database, id))!
        expect(before.version).toBe(MAX_ENTITY_VERSION)
        expect(await accountRepository.updateOrdinary(client.database, id, MAX_ENTITY_VERSION, actor, {displayName: 'Must not write'})).toBe(false)
        expect(await authRepository.replacePassword(client.database, id, MAX_ENTITY_VERSION, 'must-not-write', new Date())).toBe(false)
        expect(await accountRepository.findById(client.database, id)).toMatchObject({version: MAX_ENTITY_VERSION, displayName: 'Last update', passwordHash: before.passwordHash})
    })
    it('角色、菜单、字典和参数仓储同样拒绝耗尽版本的递增', async () => {
        const role = await roleRepository.insert(client.database, {code: 'version_role', name: 'Role', enabled: true, createdBy: actor, updatedBy: actor})
        await menuRepository.insert(client.database, {code: 'version_menu', name: 'Menu', iconKey: 'folder', parentId: null, pageKey: null, sortOrder: 0, visible: true})
        const menu = (await menuRepository.byCode(client.database, 'version_menu'))!
        const dictionaryId = await dictionaryRepository.insert(client.database, {code: 'version_dictionary', name: 'Dictionary'})
        const dictionary = (await dictionaryRepository.find(client.database, dictionaryId))!
        await client.database.insert(adminParameters).values(await withEntityIds(client.database, 'admin_parameters', {key: 'fixture.version', defaultValue: 'null', value: 'before'}))
        const parameter = (await parameterRepository.find(client.database, 'fixture.version'))!
        await client.database.update(adminRoles).set({version: MAX_ENTITY_VERSION}).where(eq(adminRoles.id, role))
        await client.database.update(adminMenus).set({version: MAX_ENTITY_VERSION}).where(eq(adminMenus.id, menu.id))
        await client.database.update(adminDictionaries).set({version: MAX_ENTITY_VERSION}).where(eq(adminDictionaries.id, dictionary.id))
        await client.database.update(adminParameters).set({version: MAX_ENTITY_VERSION}).where(eq(adminParameters.id, parameter.id))
        expect(await roleRepository.update(client.database, role, MAX_ENTITY_VERSION, actor, {name: 'Must not write'})).toBe(false)
        expect(await menuRepository.update(client.database, menu.id, MAX_ENTITY_VERSION, actor, {name: 'Must not write', parentId: menu.parentId, sortOrder: menu.sortOrder, visible: menu.visible})).toBe(false)
        expect(await dictionaryRepository.update(client.database, dictionary.id, MAX_ENTITY_VERSION, actor, {name: 'Must not write'})).toBe(false)
        expect(await parameterRepository.update(client.database, parameter.id, MAX_ENTITY_VERSION, 'must-not-write', actor)).toBe(false)
        expect(await roleRepository.find(client.database, role)).toMatchObject({name: 'Role', version: MAX_ENTITY_VERSION})
        expect(await menuRepository.byCode(client.database, menu.code)).toMatchObject({name: menu.name, version: MAX_ENTITY_VERSION})
        expect(await dictionaryRepository.find(client.database, dictionary.id)).toMatchObject({name: dictionary.name, version: MAX_ENTITY_VERSION})
        expect(await parameterRepository.findById(client.database, parameter.id)).toMatchObject({value: parameter.value, version: MAX_ENTITY_VERSION})
    })
})
