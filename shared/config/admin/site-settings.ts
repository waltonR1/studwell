// 后台站点设置的语言、分区及审计字段名称；空值工厂位于 utils/admin/site-settings。
import {supportedLanguageCatalog} from '../site-languages'
import type {SiteLocale, SiteSection} from '../../schemas/admin/site-settings'

export const siteLocaleNames = Object.fromEntries(supportedLanguageCatalog.map(language => [language.code, language.adminName])) as Record<SiteLocale, string>
export const siteSectionNames: Record<SiteSection, string> = {basic: '网站标识', header: '页头维护', footer: '页脚'}
export const siteFieldNames: Record<string, string> = {
    logoId: '网站标识',
    faviconId: '浏览器图标',
    contactTitle: '联系区标题',
    contactTarget: '联系区链接',
    contacts: '联系条目',
    tagline: '展开菜单介绍文字',
    items: '导航入口',
    description: '页脚简介',
    copyrightHolder: '版权归属',
    groups: '链接分组'
}
