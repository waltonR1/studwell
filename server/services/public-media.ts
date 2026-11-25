// 解析公开媒体引用并投影访问数据，不承担上传管理。
import type {DatabaseExecutor} from '../db/transaction'
import type {PublicMedia} from '#shared/types/public/website'
import {mediaRepository} from '../repositories/media'
import {ApiError} from '../core/errors'

// 仅解析既有文件 URL，不新增媒体路由或发布引用访问控制。
export function createPublicMediaResolver(database: DatabaseExecutor) {
  const cache = new Map<string, Promise<PublicMedia>>()
  return async (id: string, kind?: 'image' | 'video'): Promise<PublicMedia> => {
    let pending = cache.get(id)
    if (!pending) {
      pending = (async () => {
        const row = await mediaRepository.find(database, BigInt(id))
        if (!row || !/^uploads\/[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(row.storageKey)) throw new ApiError('INTERNAL_ERROR')
        return {id: String(row.id), src: `/${row.storageKey}`, kind: row.kind, mime: row.mime}
      })()
      cache.set(id, pending)
    }
    const value = await pending
    if (kind && value.kind !== kind) throw new ApiError('INTERNAL_ERROR')
    return value
  }
}
