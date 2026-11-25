// 协调区块插入、排序与移除，不处理模板组件渲染。
import type {DatabaseExecutor} from '../db/transaction'
import {websitePageRepository as pages} from '../repositories/website-pages'
import {mediaRepository} from '../repositories/media'
import {conflictError} from '../core/errors'
import {siteLocales} from '#shared/schemas/admin/site-settings'
import {emptySectionContent} from '#shared/utils/website/page-layouts'
import type {SectionTemplate} from '#shared/types/website/section-template'

export async function insertSection(tx:DatabaseExecutor,actor:bigint,resourceId:bigint,templateId:bigint,templateRevision:number,definition:SectionTemplate,placement:{instanceName?:string;sortOrder:number;visible:boolean;anchorKey:string},localized?:Record<string,unknown>){
 return pages.insertSection(tx,{resourceId,templateId,templateRevision,...placement,sharedContent:{media:definition.mediaSlots.map(({key,name})=>({key,name,mediaId:null}))},localizedContent:localized??Object.fromEntries(siteLocales.map(locale=>[locale,emptySectionContent(definition.fields)])),createdBy:actor,updatedBy:actor})
}

export async function placeSection(tx:DatabaseExecutor,actor:bigint,id:bigint,version:number,placement:{sortOrder:number;visible:boolean}){
 if(!await pages.place(tx,id,version,{...placement,updatedBy:actor,updatedAt:new Date()}))throw conflictError('STALE','structureVersion')
}

export async function removeSection(tx:DatabaseExecutor,id:bigint){
 await mediaRepository.replaceReferences(tx,`website:section:${id}`,[])
 await pages.remove(tx,id)
}
