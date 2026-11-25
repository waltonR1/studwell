// Public settings read model; mutations and historical reads use website-publishing.
import type {DatabaseExecutor} from '../db/transaction'
import type {siteSettingsRepository} from '../repositories/site-settings'
import {resourcePublication} from './website-read-model'
import {siteSections} from '#shared/schemas/admin/site-settings'
import type {SitePublication} from '#shared/types/admin/site-settings'
export async function sitePublication(db:DatabaseExecutor,row:NonNullable<Awaited<ReturnType<typeof siteSettingsRepository.find>>>):Promise<Record<typeof siteSections[number],SitePublication>>{
 return Object.fromEntries(await Promise.all(siteSections.map(async section=>{const p=await resourcePublication(db,row.resources[section]);return [section,{...p,changedSections:p.changed?[section]:[]}]}))) as Record<typeof siteSections[number],SitePublication>
}
