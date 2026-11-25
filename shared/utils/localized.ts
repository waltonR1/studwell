// 为新建内容生成独立语言槽位；已有内容允许缺席，读取和校验不会自动补写。
import {supportedLocales, type SupportedLocale} from '../config/site-languages'

export function createLocalized<T>(factory: (locale: SupportedLocale) => T): Record<SupportedLocale, T> {
    return Object.fromEntries(supportedLocales.map(locale => [locale, factory(locale)])) as Record<SupportedLocale, T>
}

export const emptyLocalizedText = () => createLocalized(() => '')
