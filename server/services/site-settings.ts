// 协调站点基础设置业务规则、权限及持久化调用，不直接处理 HTTP 或 ORM。
import {assertBasicImagePresentations} from './website-image-rules'
import {websiteResourceRepository} from '../repositories/website-resources'
import {resourceSnapshot} from './website-read-model'
import {projectPublicSiteSettings} from './public-site-settings'
import type {PublicLocale} from '#shared/schemas/public/queries'
import {sameLinkTarget} from '#shared/utils/website/link-target'
import {sitePublication} from './site-publishing'
import type {Database} from '../db/transaction'
import type {AuthMeta} from '../core/auth-context'
import {siteSettingsRepository as repo} from '../repositories/site-settings'
import {mediaRepository} from '../repositories/media'
import {requirePermission} from './access/permissions'
import {parseInput} from '../core/validation'
import {ApiError, conflictError} from '../core/errors'
import {auditedWrite} from './operations/audited-write'
import {siteSettingsUpdateSchema, type SiteLink} from '#shared/schemas/admin/site-settings'
import type {SiteSettingsRecord} from '#shared/types/admin/site-settings'
import {createSiteSettings} from '#shared/utils/admin/site-settings'
import {siteSectionNames,siteFieldNames} from '#shared/config/admin/site-settings'
import {websiteNavigationTargets} from './website-navigation-targets'
import {auditChanges} from '../policies/audit-changes'

function dto(row: Awaited<ReturnType<typeof repo.find>>): SiteSettingsRecord {
    return {content: row?.content ?? createSiteSettings(), versions: {basic: row?.basicVersion ?? 0, header: row?.headerVersion ?? 0, footer: row?.footerVersion ?? 0}, updatedAt: row?.updatedAt.toISOString() ?? null, updatedBy: row ? String(row.updatedBy) : null, targets: []}
}
async function validateLinks(db:Parameters<typeof websiteNavigationTargets>[0],links: SiteLink[]) {
    const targets=await websiteNavigationTargets(db)
    if (links.some(({target}) => ('resourceId' in target) && !targets.some(item => sameLinkTarget(target,item.target)))) throw new ApiError('INVALID_INPUT', [{path: 'content', message: '请选择有效的页面或栏目'}])
}
export function createSiteSettingsService(db: Database) {
    return {
        async preview(actor: bigint, input: {locale?: PublicLocale; section: 'header' | 'footer'; mode: 'draft' | 'published'}) {
            const {locale, section, mode} = input
            return db.transaction(async tx => {
                await requirePermission(tx, actor, 'content.site_settings.read')
                const resource = await websiteResourceRepository.find(tx, 'site.' + section)
                if (!resource || resource.type !== section || (mode === 'published' && !resource.publishedReleaseId)) throw new ApiError('NOT_FOUND')
                const draft = mode === 'draft' ? {section, content: await resourceSnapshot(tx, resource)} : undefined
                const settings = await projectPublicSiteSettings(tx, locale, true, undefined, draft)
                return {...settings, header: section === 'header' ? settings.header : null, footer: section === 'footer' ? settings.footer : null}
            }, {isolationLevel: 'repeatable read'})
        },
        async read(actor: bigint) {
            await requirePermission(db, actor, 'content.site_settings.read')
            // 一致性快照保证页面文字、导航及其版本来自同一次读取。
            return db.transaction(async tx => {const row=await repo.find(tx);const targets=await websiteNavigationTargets(tx);return {...dto(row),targets,publication:row?await sitePublication(tx,row):undefined}}, {isolationLevel: 'repeatable read'})
        },
        async update(actor: bigint, raw: unknown, meta: AuthMeta) {
            const input = await parseInput(siteSettingsUpdateSchema, raw)
            const sectionName = siteSectionNames[input.section]
            try {
                return await auditedWrite(db, {actor, meta, action: 'site_settings.update', id: null, targetType: 'site_settings', targetName: sectionName, isolationLevel: 'read committed'}, async tx => {
                    await requirePermission(tx, actor, 'content.site_settings.update')
                    let row = await repo.find(tx, input.section)
                    if ((row ? dto(row).versions[input.section] : 0) !== input.version) throw conflictError('STALE', 'version')
                    if (input.section === 'header') await validateLinks(tx,input.content.items.filter(item=>item.visible).flatMap(item => [item, ...item.children.filter(child=>child.visible)]))
                    if (input.section === 'footer') await validateLinks(tx,[...input.content.groups.filter(group=>group.visible).flatMap(group => group.items.filter(item=>item.visible)),...(input.content.contactTarget ? [{id:'contact_heading',label:input.content.contactTitle,target:input.content.contactTarget,visible:true}] : [])])
                    if (!row) { await repo.insert(tx, createSiteSettings(), actor, 0); row = (await repo.find(tx))! }
                    if (input.section === 'basic') {
                        await assertBasicImagePresentations(tx,input.content)
                        const entries = (['logoId', 'faviconId'] as const).flatMap(field => input.content[field] ? [{field, mediaId: BigInt(input.content[field]!)}] : [])
                        for (const entry of entries) {
                            const media = await mediaRepository.find(tx, entry.mediaId)
                            if (!media || media.kind !== 'image') throw new ApiError('INVALID_INPUT', [{path: `content.${entry.field}`, message: '请选择媒体库中的图片'}])
                        }
                        try { await mediaRepository.replaceReferences(tx, `website:draft:${row!.resources.basic.id}`, entries) }
                        catch (error) {
                            if (error instanceof Error && error.message === 'MEDIA_REFERENCE_NOT_FOUND') throw new ApiError('INVALID_INPUT', [{path: 'content', message: '选中的图片已被删除，请重新选择'}])
                            throw error
                        }
                    }
                    if (!await repo.update(tx, row.id, input, actor)) throw conflictError('STALE', 'version')
                    const next = (await repo.find(tx))!
                    const changedFields = Object.keys(input.content).filter(key => JSON.stringify((row.content[input.section] as Record<string, unknown>)[key]) !== JSON.stringify((input.content as Record<string, unknown>)[key])).map(key => siteFieldNames[key] ?? key).join('、')
                    return {id:next.resources[input.section].id,name:sectionName,changes:auditChanges('site_settings', {settingsVersion: input.version}, {settingsVersion: dto(next).versions[input.section], settingsSection: sectionName, settingsFields: changedFields}),value:{...dto(next),targets:await websiteNavigationTargets(tx),publication:await sitePublication(tx,next)}}
                })
            } catch (error) {
                if (error instanceof ApiError && error.reason === 'DUPLICATE') throw conflictError('STALE', 'version')
                throw error
            }
        },
    }
}
