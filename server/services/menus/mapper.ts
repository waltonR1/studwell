// 持久化记录到响应合同的投影；不承担树约束或授权。
import type {MenuRow} from '../../repositories/menus'
import type {MenuRecord} from '#shared/types/admin/menus'
import {isMenuIconKey} from '#shared/utils/admin/menu-icons'
import {ApiError} from '../../core/errors'

export function storedIcon(value: unknown) {
    if (!isMenuIconKey(value)) throw new ApiError('INTERNAL_ERROR');
    return value
}

export const dto = (row: MenuRow): MenuRecord => ({
    iconKey: storedIcon(row.iconKey),
    id: String(row.id),
    parentId: row.parentId === null ? null : String(row.parentId),
    code: row.code,
    pageKey: row.pageKey,
    name: row.name,
    sortOrder: row.sortOrder,
    visible: row.visible,
    version: row.version,
    createdBy: row.createdBy === null ? null : String(row.createdBy),
    updatedBy: row.updatedBy === null ? null : String(row.updatedBy),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
})
