// 将校验失败转换为统一业务错误，不读取 HTTP 请求。
import {z} from 'zod'
import {ApiError} from './errors'

export async function parseInput<S extends z.ZodType>(schema: S, input: unknown): Promise<z.output<S>> {
    const result = await schema.safeParseAsync(input)
    if (!result.success) {
        throw new ApiError('INVALID_INPUT', result.error.issues.slice(0, 20).map(issue => ({
            path: issue.path.map(String).join('.').slice(0, 160),
            message: '字段值不符合要求',
        })))
    }
    return result.data
}

