// 按公开路径解析已发布页面或详情目标及发布版本。
import {readPublishedSiteContext} from './site-languages'
import {sitePageEnabled,siteSnapshotEnabled} from './site-modules'
import {websiteRoutePatternIdentity} from '#shared/utils/website/route-pattern'
import {findDetailProvider} from './website-detail-providers'
import {readSiteConfig} from '../repositories/website-site-config'
import {websiteResourceRepository} from '../repositories/website-resources'
import {lookupPublishedWebsiteRoute} from '../repositories/website-route-tree'
import type {Database} from '../db/transaction'
import {ApiError} from '../core/errors'

export function resolvePublicWebsiteRoute(database: Database, path: string) {
  return database.transaction(async db=>{
    const config=await readSiteConfig(db)
    const {languageReleaseId}=await readPublishedSiteContext(db,config)
    const configReleaseId=config.publishedReleaseId===null?null:String(config.publishedReleaseId)
    const route=await lookupPublishedWebsiteRoute(db,path)
    if(!route){
     const index=path.lastIndexOf('/')
     if(index<=0)throw new ApiError('NOT_FOUND')
     const prefix=path.slice(0,index)
     const slug=path.slice(index+1)
     const detail=await lookupPublishedWebsiteRoute(db,prefix+'/:slug')
     if(detail&&websiteRoutePatternIdentity(detail.path)){
      const resource=await websiteResourceRepository.find(db,detail.resourceKey)
      const release=resource?.publishedReleaseId?await websiteResourceRepository.release(db,resource.publishedReleaseId,resource.id):undefined
      if(!await sitePageEnabled(db,detail.resourceKey.slice(5))||!await siteSnapshotEnabled(db,release?.content))throw new ApiError('NOT_FOUND')
      const provider=await findDetailProvider(db,'slug',release?.content)
      if(!provider||!await provider.exists(db,slug))throw new ApiError('NOT_FOUND')
      return {configReleaseId,languageReleaseId,path,pageKey:detail.resourceKey.slice(5),targetType:provider.type,targetKey:slug}
     }
     throw new ApiError('NOT_FOUND')
    }
    const key=route.resourceKey.slice(5)
    if(!await sitePageEnabled(db,key))throw new ApiError('NOT_FOUND')
    const resource=await websiteResourceRepository.find(db,route.resourceKey)
    const release=resource?.publishedReleaseId?await websiteResourceRepository.release(db,resource.publishedReleaseId,resource.id):undefined
    if(!release||!await siteSnapshotEnabled(db,release.content))throw new ApiError('NOT_FOUND')
    return {configReleaseId,languageReleaseId,path:route.path,pageKey:route.resourceKey.slice(5),targetType:'page' as const,targetKey:''}
  },{isolationLevel:'repeatable read'})
}
