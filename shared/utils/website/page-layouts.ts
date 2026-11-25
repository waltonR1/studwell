// 页面和区块的空值构造、模板适用范围及排序计算，不读取数据库或业务内容。
import {emptyLocalizedText} from '../localized'
import type {WebsitePageSettings} from '../../schemas/website/page-settings'
import type {SectionTemplate, SectionField} from '../../types/website/section-template'

export const websitePageKey = (code: string) => code.replace(/^website_/, '')

export function emptyPageSettings(): WebsitePageSettings {
    return {displayName: emptyLocalizedText(), sceneEnabled: false, sceneTransitionSeconds: null}
}

export function templateSupportsPage(template: SectionTemplate, key: string) {
    return template.allowedPages === 'all' || template.allowedPages.includes(key)
}

export function emptySectionContent(field: SectionField): unknown {
    return field.kind === 'tree' ? {
        ...Object.fromEntries(Object.entries(field.fields).filter(([, f]) => !f.optional).map(([key, value]) => [key, emptySectionContent(value)])),
        children: []
    } : field.kind === 'group' ? Object.fromEntries(Object.entries(field.fields ?? {}).filter(([, f]) => !f.optional).map(([key, value]) => [key, emptySectionContent(value)])) : field.kind === 'list' ? [] : field.kind === 'media' ? {mediaId: null} : field.kind === 'link' ? null : field.kind === 'number' ? 0 : field.kind === 'boolean' ? false : ''
}

type SectionPlacement = { id: string; sortOrder: number }

export function normalizeSectionPlacement<T extends SectionPlacement>(sections: T[]): T[] {
    return [...sections].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)).map((section, sortOrder) => ({
        ...section,
        sortOrder
    }))
}
