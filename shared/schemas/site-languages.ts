// 站点语言配置校验：启用集合非空、无重复且包含默认语言。
import {z} from 'zod'
import {supportedLocales} from '../config/site-languages'

export const siteLanguagesSchema = z.strictObject({
    enabledLocales: z.array(z.enum(supportedLocales)).min(1).max(supportedLocales.length)
        .refine(values => new Set(values).size === values.length, '语言不能重复。'),
    defaultLocale: z.enum(supportedLocales),
}).refine(value => value.enabledLocales.includes(value.defaultLocale), {
    path: ['defaultLocale'],
    message: '默认语言必须属于启用语言。'
})
