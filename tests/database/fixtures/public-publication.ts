// Test-only convenience for exercising the three public resource types uniformly.
import type {Database} from '../../../server/db/transaction'
import type {AuthMeta} from '../../../server/core/auth-context'
import {createWebsitePublishingService} from '../../../server/services/website-publishing'
import {websiteResourceRepository} from '../../../server/repositories/website-resources'
import {z} from 'zod'
import {websitePublishSchema,websiteRestoreSchema} from '../../../shared/schemas/admin/website'
import {entityIdSchema} from '../../../shared/schemas/entity'
import {siteSections,type SiteSettings} from '../../../shared/schemas/admin/site-settings'
import type {WebsitePublication} from '../../../shared/types/admin/website'
const sitePublishSchema=websitePublishSchema.omit({stateVersion:true}).extend({section:z.enum(siteSections)}),siteRestoreSchema=websiteRestoreSchema.omit({stateVersion:true}).extend({section:z.enum(siteSections)}),siteReleaseQuerySchema=z.strictObject({section:z.enum(siteSections),releaseId:entityIdSchema})
export function publicPublicationFixture(db:Database){
 const service=createWebsitePublishingService(db)
 const adapt=(p:WebsitePublication,section:string)=>({...p,changedSections:p.changed?[section]:[]})
 return {
  async publish(actor:bigint,raw:unknown,meta:AuthMeta){const {section,...input}=sitePublishSchema.parse(raw);return adapt(await service.publish(actor,`site.${section}`,{...input,stateVersion:(await websiteResourceRepository.find(db,`site.${section}`))!.stateVersion},meta),section)},
  async restore(actor:bigint,raw:unknown,meta:AuthMeta){const {section,...input}=siteRestoreSchema.parse(raw);return adapt(await service.restore(actor,`site.${section}`,{...input,stateVersion:(await websiteResourceRepository.find(db,`site.${section}`))!.stateVersion},meta),section)},
  async detail(actor:bigint,raw:unknown){const {section,releaseId}=siteReleaseQuerySchema.parse(raw);const result=await service.detail(actor,`site.${section}`,releaseId);return {...result,section,content:{[section]:result.content} as Partial<SiteSettings>}},
  async published(){const content:Partial<SiteSettings>={};for(const section of siteSections){const r=await websiteResourceRepository.find(db,`site.${section}`);if(r?.publishedReleaseId){const release=await websiteResourceRepository.release(db,r.publishedReleaseId,r.id);Object.assign(content,{[section]:release?.content})}}return Object.keys(content).length?content:null},
 }
}
