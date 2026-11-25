// 搜索文件 HTTP 入口：转换服务结果并设置缓存及错误响应。
import {createError, defineEventHandler, getRouterParam, setResponseHeader} from 'h3'
import {getDatabase} from '#server/db'
import {readSearchFile, SearchFileError} from '../../services/search-files'

export default defineEventHandler(async event => {
    try {
        const {content, manifest} = await readSearchFile(getDatabase(), getRouterParam(event, 'filename') ?? '')
        setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
        setResponseHeader(event, 'Cache-Control', manifest ? 'no-store' : 'public, max-age=31536000, immutable')
        return content
    } catch (cause) {
        setResponseHeader(event, 'Cache-Control', 'no-store')
        throw createError({statusCode: cause instanceof SearchFileError && cause.reason === 'missing' ? 404 : 503})
    }
})
