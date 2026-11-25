// 多语言数据允许已登记语言缺席；仅校验实际存在的键和值，启用范围由服务端另行检查。
import {z} from 'zod'
import {supportedLocales} from '../config/site-languages'

export function localizedSchema<T extends z.ZodType>(schema: T) {
    const locale = z.string().refine(value => supportedLocales.includes(value as typeof supportedLocales[number]), 'Unsupported content locale')
    return z.record(locale, schema)
}
