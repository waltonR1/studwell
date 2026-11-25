// 按组件代称解析数据库路径，并限定公开与预览目录的范围。
import type {DatabaseExecutor} from '../db/transaction'
import {ApiError} from '../core/errors'
import {readWebsiteRenderers} from '../repositories/website-renderers'

const publicPath = /^app\/components\/public\/sections\/(?:[\w.-]+\/)*[\w.-]+\.vue$/
const previewPath = /^app\/components\/admin\/preview\/templates\/(?:[\w.-]+\/)*[\w.-]+\.vue$/

export function isWebsiteRendererPath(scope: 'public' | 'preview', path: string) {
    return !path.split('/').some(segment => segment === '.' || segment === '..') &&
        (publicPath.test(path) || (scope === 'preview' && previewPath.test(path)))
}

export async function websiteRendererPaths(db: DatabaseExecutor, scope: 'public' | 'preview') {
    const paths = new Map((await readWebsiteRenderers(db, scope)).map(({key, path}) => [key, path]))
    return (key: string) => {
        const path = paths.get(key)
        if (!path || !isWebsiteRendererPath(scope, path)) {
            throw new ApiError('INTERNAL_ERROR')
        }
        return path
    }
}
