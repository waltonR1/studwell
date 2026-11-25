import type {SiteModuleName} from '#shared/config/site-modules'
// 读取模块策略并判断页面、模板和管理入口的可用性。
import {modulePolicyChecks} from '../policies/site-modules'
import type {DatabaseExecutor} from '../db/transaction'
import {readWebsiteModulePolicy} from '../repositories/website-module-policy'
import {ApiError} from '../core/errors'
export async function readModuleChecks(db:DatabaseExecutor){return modulePolicyChecks((await readWebsiteModulePolicy(db)).policy)}
export async function siteModules(db:DatabaseExecutor){return (await readWebsiteModulePolicy(db)).policy.enabled}
export async function moduleEnabled(db:DatabaseExecutor,module:SiteModuleName){return (await siteModules(db))[module]}
export async function requireSiteModule(db:DatabaseExecutor,module:SiteModuleName){if(!await moduleEnabled(db,module))throw new ApiError('NOT_FOUND')}
export async function sitePageEnabled(db:DatabaseExecutor,key:string){return (await readModuleChecks(db)).page(key)}
export async function siteTemplateEnabled(db:DatabaseExecutor,key:string){return (await readModuleChecks(db)).template(key)}
export async function siteSnapshotEnabled(db:DatabaseExecutor,content:unknown){return (await readModuleChecks(db)).snapshot(content)}

export async function readSiteModulePolicyVersion(db:DatabaseExecutor){return (await readWebsiteModulePolicy(db)).version}
