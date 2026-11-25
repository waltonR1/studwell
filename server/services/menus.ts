// 协调菜单业务规则、权限及持久化调用，不直接处理 HTTP 或 ORM。
import {assertVisiblePublishedPages,hidePageReason} from './website-menu-lifecycle'
import {websiteResourceRepository} from '../repositories/website-resources'
import {websitePageKey} from '#shared/utils/website/page-layouts'
import {menuPagePath} from '../policies/menu-path'
import {MAX_MENU_SORT_ORDER} from '#shared/config/admin/menus'
import {auditedWrite, type AuditedResult} from './operations/audited-write'
import {requirePermission as checkPermission} from './access/permissions'
import {auditChanges} from '../policies/audit-changes'
import {auditService} from './audit'
// 菜单业务：树约束、导航投影、授权上限与同事务审计。
import {createHash} from 'node:crypto'
import type {Database, DatabaseExecutor, DatabaseTransaction} from '../db/transaction'
import type {AuthMeta} from '../core/auth-context'
import {getPermissionSnapshot} from './access/permissions'
import {menuRepository as repo, type MenuRow} from '../repositories/menus'
import {menuPageCatalog, MAX_MENU_DEPTH, MAX_MENU_COUNT} from '../config/menus'
import {ApiError, conflictError} from '../core/errors'
import {entityIdSchema} from '#shared/schemas/entity'
import {parseInput} from '../core/validation'
import {menuCreateSchema, menuUpdateSchema, menuMoveSchema, menuDeleteSchema} from '#shared/schemas/admin/menus.ts'
import type {MenuPageCatalogItem} from '#shared/types/admin/menus.ts'

import {page, ordered, validateTree} from '../policies/menu-model'
import {dto, storedIcon} from './menus/mapper'

export function createMenuService(database: Database) {
    const requirePermission = (actor: bigint, permission: string, executor: DatabaseExecutor = database) => checkPermission(executor, actor, permission)

    const write = <T>(actor: bigint, meta: AuthMeta, action: string, id: bigint | null, work: (tx: DatabaseTransaction) => Promise<AuditedResult<T>>, isolationLevel: 'read committed' = 'read committed') =>
        auditedWrite(database, {actor, meta, action, id, targetType: 'menu',isolationLevel}, work)

    function checkScope(rows: MenuRow[], id: bigint, current: Awaited<ReturnType<typeof getPermissionSnapshot>>) {
        if (current.isRoot) return
        const descendants = new Set([id])
        for (let depth = 0; depth < MAX_MENU_DEPTH; depth++) for (const row of rows) if (row.parentId !== null && descendants.has(row.parentId)) descendants.add(row.id)
        if (rows.some(row => descendants.has(row.id) && row.pageKey !== null && (!page(row.pageKey) || !current.permissions.includes(page(row.pageKey)!.permission)))) throw new ApiError('FORBIDDEN')
    }

    async function appendOrder(tx: DatabaseTransaction, rows: MenuRow[], parentId: bigint | null, actor: bigint, current: Awaited<ReturnType<typeof getPermissionSnapshot>>, meta: AuthMeta, exclude?: bigint) {
        const siblings = ordered(rows).filter(row => row.parentId === parentId && row.id !== exclude)
        const maximum = Math.max(-1, ...siblings.map(row => row.sortOrder))
        if (maximum < MAX_MENU_SORT_ORDER) return maximum + 1
        for (const [index, row] of siblings.entries()) {
            if (row.sortOrder === index) continue
            checkScope(rows, row.id, current)
            if (!await repo.update(tx, row.id, row.version, actor, {
                name: row.name,
                parentId,
                sortOrder: index,
                visible: row.visible
            })) throw conflictError('STALE', 'version')
        }
        for (const [index, row] of siblings.entries()) {
            if (row.sortOrder === index) continue
            await auditService.write(tx, {actorId: actor, action: 'menus.update', targetType: 'menu', targetId: String(row.id), targetName: row.name, result: 'success', createdAt: new Date(), ...meta, changeContext: auditChanges('menu', row, {...row, sortOrder: index})})
        }
        return siblings.length
    }

    return {
        async list(actor: bigint) {
            await requirePermission(actor, 'system.menus.read')
            const rows = await repo.all(database)
            validateTree(rows)
            const keys=new Set((await websiteResourceRepository.all(database)).filter(row=>row.type==='page'&&row.publishedReleaseId).map(row=>row.key))
            return ordered(rows).map(row=>({...dto(row),hideDisabledReason:hidePageReason(rows,row.id,keys),deleteDisabledReason:row.pageKey==='website_page'?'请在页面维护中永久删除页面':rows.some(child=>child.parentId===row.id)?'请先移动或删除子节点':undefined}))
        },
        async catalog(actor: bigint): Promise<MenuPageCatalogItem[]> {
            const current = await requirePermission(actor, 'system.menus.read')
            return menuPageCatalog.map(item => ({
                ...item,
                grantable: item.available && (current.isRoot || current.permissions.includes(item.permission))
            }))
        },
        async create(actor: bigint, input: unknown, meta: AuthMeta) {
            const data = await parseInput(menuCreateSchema, input)
            return write(actor, meta, 'menus.create', null, async tx => {
                const current = await requirePermission(actor, 'system.menus.create', tx)
                const rows = await repo.all(tx, true)
                if (rows.length >= MAX_MENU_COUNT) throw new ApiError('CONFLICT')
                if (data.pageKey !== null && (!page(data.pageKey) || page(data.pageKey)!.builtin || (!current.isRoot && !current.permissions.includes(page(data.pageKey)!.permission)))) throw new ApiError('FORBIDDEN')
                if(data.pageKey==='website_page'){
                    const key=websitePageKey(data.code)
                    if(!/^[a-z][a-z0-9_-]{0,63}$/.test(key)||rows.some(r=>r.pageKey==='website_page'&&r.code!==data.code&&websitePageKey(r.code)===key))throw new ApiError('INVALID_INPUT',[{path:'code',message:'页面编码已被占用或保留。'}])
                }
                const parentId = data.parentId === null ? null : BigInt(data.parentId)
                if (parentId !== null) checkScope(rows, parentId, current)
                const sortOrder = await appendOrder(tx, rows, parentId, actor, current, meta)
                const candidate = {
                    ...data,
                    iconKey: data.iconKey,
                    sortOrder,
                    id: 0n,
                    parentId,
                    version: 1,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    createdBy: actor,
                    updatedBy: actor
                }
                validateTree([...rows, candidate])
                const id = await repo.insert(tx, {...data, sortOrder, parentId, createdBy: actor, updatedBy: actor})
                const created = (await repo.all(tx, true)).find(row => row.id === id)!
                return {value: dto(created), id, name: created.name, changes: auditChanges('menu', null, created)}
            })
        },
        async update(actor: bigint, raw: string, input: unknown, meta: AuthMeta) {
            const id = BigInt(await parseInput(entityIdSchema, raw)), data = await parseInput(menuUpdateSchema, input)
            return write(actor, meta, 'menus.update', id, async tx => {
                const current = await requirePermission(actor, 'system.menus.update', tx),
                    rows = await repo.all(tx, true)
                const row = rows.find(item => item.id === id)
                if (!row) throw new ApiError('NOT_FOUND')
                if (row.version !== data.version) throw conflictError('STALE', 'version')
                checkScope(rows, id, current)
                const parentId = data.parentId === null ? null : BigInt(data.parentId)
                if (parentId !== null) checkScope(rows, parentId, current)
                const sortOrder = parentId === row.parentId ? row.sortOrder : await appendOrder(tx, rows, parentId, actor, current, meta, id)
                const next=rows.map(item => item.id === id ? {...item, ...data, parentId, sortOrder} : item)
                validateTree(next)
                await assertVisiblePublishedPages(tx,next)
                if (!await repo.update(tx, id, data.version, actor, {
                    iconKey: data.iconKey,
                    name: data.name,
                    parentId,
                    sortOrder,
                    visible: data.visible
                })) throw conflictError('STALE', 'version')
                const updated = (await repo.all(tx, true)).find(item => item.id === id)!
                return {
                    value: dto(updated),
                    id,
                    name: updated.name,
                    changes: auditChanges('menu', row, updated),
                    auditAction: data.visible !== row.visible && data.name === row.name && data.iconKey === row.iconKey && parentId === row.parentId ? (data.visible ? 'menus.show' : 'menus.hide') : undefined
                }
            })
        },
        async move(actor: bigint, raw: string, input: unknown, meta: AuthMeta) {
            const id = BigInt(await parseInput(entityIdSchema, raw)), data = await parseInput(menuMoveSchema, input)
            return write(actor, meta, data.direction === 'up' ? 'menus.move_up' : 'menus.move_down', id, async tx => {
                const current = await requirePermission(actor, 'system.menus.update', tx),
                    rows = await repo.all(tx, true)
                const row = rows.find(item => item.id === id)
                if (!row) throw new ApiError('NOT_FOUND')
                const siblings = ordered(rows).filter(item => item.parentId === row.parentId)
                const index = siblings.findIndex(item => item.id === id),
                    target = index + (data.direction === 'up' ? -1 : 1)
                const neighbor = siblings[target]
                if (row.version !== data.version || !neighbor || String(neighbor.id) !== data.neighborId || neighbor.version !== data.neighborVersion) throw conflictError('STALE', 'version')
                    ;
                [siblings[index], siblings[target]] = [neighbor, row]
                const changes = new Set(siblings.map(item => item.sortOrder)).size !== siblings.length
                    ? siblings.map((item, position) => ({
                        item,
                        sortOrder: position
                    })).filter(change => change.item.sortOrder !== change.sortOrder || change.item.id === row.id || change.item.id === neighbor.id)
                    : [{item: row, sortOrder: neighbor.sortOrder}, {item: neighbor, sortOrder: row.sortOrder}]
                for (const {item, sortOrder} of changes) {
                    checkScope(rows, item.id, current)
                    if (!await repo.update(tx, item.id, item.version, actor, {
                        name: item.name,
                        parentId: item.parentId,
                        sortOrder,
                        visible: item.visible
                    })) throw conflictError('STALE', 'version')
                }
                for (const {item, sortOrder} of changes.filter(change => change.item.id !== id)) {
                    await auditService.write(tx, {...meta, actorId: actor, action: 'menus.update', targetType: 'menu', targetId: String(item.id), targetName: item.name, result: 'success', createdAt: new Date(), changeContext: auditChanges('menu', item, {...item, sortOrder})})
                }
                return {value: null, id, name: row.name, changes: auditChanges('menu', row, {...row, sortOrder: changes.find(change => change.item.id === id)!.sortOrder})}
            })
        },
        async remove(actor: bigint, raw: string, input: unknown, meta: AuthMeta) {
            const id = BigInt(await parseInput(entityIdSchema, raw)), {version} = await parseInput(menuDeleteSchema, input)
            return write(actor, meta, 'menus.delete', id, async tx => {
                const current = await requirePermission(actor, 'system.menus.delete', tx),
                    rows = await repo.all(tx, true), row = rows.find(item => item.id === id)
                if (!row) throw new ApiError('NOT_FOUND')
                if (row.version !== version) throw conflictError('STALE', 'version')
                checkScope(rows, id, current)
                if(row.pageKey==='website_page')throw new ApiError('INVALID_INPUT',[{path:'menu',message:'请在页面维护中永久删除页面'}])
                if (rows.some(item => item.parentId === id) || await repo.referenced(tx, id)) throw conflictError('REFERENCED', 'references')

                await repo.remove(tx, id)
                return {value: null, id, name: row.name, changes: auditChanges('menu', row, null)}
            },'read committed')
        },
        async navigation(actor: bigint) {
            const current = await getPermissionSnapshot(database, actor), rows = await repo.all(database)
            validateTree(rows)
            const assigned = new Set((await repo.assigned(database, actor)).map(String)), included = new Set<bigint>(), accessible = new Set<bigint>()
            const map = new Map(rows.map(row => [row.id, row]))
            for (const row of rows) {
                const definition = page(row.pageKey)
                if (definition?.key === 'site_modules' && !current.isRoot) continue
                if (!definition || (!current.isRoot && (!assigned.has(String(row.id)) || !current.permissions.includes(definition.permission)))) continue
                const chain = [row]
                let parent = row.parentId === null ? undefined : map.get(row.parentId)
                while (parent) {
                    chain.push(parent);
                    parent = parent.parentId === null ? undefined : map.get(parent.parentId)
                }
                if (chain.some(item => !item.visible)) continue
                accessible.add(row.id)
                for (const item of chain) included.add(item.id)
            }
            const items = ordered(rows).filter(row => included.has(row.id)).map(row => ({
                iconKey: storedIcon(row.iconKey),
                id: String(row.id),
                parentId: row.parentId === null ? null : String(row.parentId),
                code: row.code,
                name: row.name,
                path: accessible.has(row.id)?menuPagePath(page(row.pageKey), row.code):null
            }))
            return {
                items,
                version: createHash('sha256').update(JSON.stringify({items, permissions: current.version})).digest('hex')
            }
        },
    }
}
