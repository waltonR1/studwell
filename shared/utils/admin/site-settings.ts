// 后台站点设置的空值工厂；仅初始化新草稿，不覆盖数据库已有内容。
import {emptyLocalizedText} from '../localized'
import type {SiteSettings, SiteLink} from '../../schemas/admin/site-settings'

export const emptySiteText = emptyLocalizedText

export function createSiteLink(id: string, target?: { module: string; resourceId: string }): SiteLink & {
    target: { module: string; type: 'page'; resourceId: string; value: string }
} {
    return {
        id,
        label: emptySiteText(),
        target: {module: target?.module ?? '', resourceId: target?.resourceId ?? '', type: 'page', value: ''},
        visible: true
    }
}

export function createSiteSettings(): SiteSettings {
    return {
        basic: {logoId: null, faviconId: null},
        header: {tagline: emptySiteText(), items: []},
        footer: {
            contactTarget: null,
            contactTitle: emptySiteText(),
            contacts: [],
            description: emptySiteText(),
            copyrightHolder: emptySiteText(),
            groups: []
        },
    }
}
