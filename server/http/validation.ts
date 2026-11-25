// 不可信输入统一经 Zod；字段反馈仅含路径和安全提示，不回传输入值。
import {getHeader, getQuery, getRouterParams, type H3Event} from 'h3'
import {z} from 'zod'
import {ApiError} from '../core/errors'

import {parseInput} from '../core/validation'

export function parseQuery<S extends z.ZodType>(event: H3Event, schema: S) {
    return parseInput(schema, getQuery(event))
}

export function parseParams<S extends z.ZodType>(event: H3Event, schema: S) {
    return parseInput(schema, getRouterParams(event))
}

export async function parseJsonBody<S extends z.ZodType>(event: H3Event, schema: S, maximum = 16 * 1024) {
    if (getHeader(event, 'content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
        throw new ApiError('UNSUPPORTED_MEDIA_TYPE')
    }
    let input: unknown
    const raw = await readLimitedBody(event, maximum, 'INVALID_JSON')
    try {
        input = JSON.parse(raw.toString('utf8'))
    } catch {
        throw new ApiError('INVALID_JSON')
    }
    return parseInput(schema, input)
}

// 实际流量也限额，不能只信任 Content-Length；超限后丢弃剩余数据，保留安全响应能力。
export function readLimitedBody(event: H3Event, maximum: number, failure: 'INVALID_JSON' | 'INVALID_INPUT' = 'INVALID_INPUT'): Promise<Buffer> {
    const req = event.node.req
    return new Promise((resolve, reject) => {
        let bytes = 0
        const chunks: Buffer[] = []
        const cleanup = () => {
            req.off('data', data);
            req.off('end', end);
            req.off('error', fail);
            req.off('aborted', abort)
        }
        const fail = () => {
            cleanup();
            reject(new ApiError(failure))
        }
        const abort = () => fail()
        const data = (chunk: Buffer) => {
            bytes += chunk.length
            if (bytes > maximum) {
                cleanup();
                chunks.length = 0;
                req.resume();
                reject(new ApiError('REQUEST_TOO_LARGE'));
                return
            }
            chunks.push(chunk)
        }
        const end = () => {
            cleanup();
            resolve(Buffer.concat(chunks))
        }
        req.on('data', data);
        req.on('end', end);
        req.on('error', fail);
        req.on('aborted', abort)
    })
}
