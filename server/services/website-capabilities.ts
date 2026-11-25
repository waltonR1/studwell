// 能力由数据库策略赋予模板，业务适配器只声明稳定的能力名。
import type {DatabaseExecutor} from '../db/transaction'
import {readWebsiteModulePolicy} from '../repositories/website-module-policy'
import type {WebsiteModulePolicy} from '#shared/schemas/website/module-policy'
export function capabilitySections(policy:WebsiteModulePolicy,content:unknown){
 const sections=(content as {sections?:Array<{visible:boolean;templateKey:string;anchorKey?:string}>})?.sections??[]
 return sections.filter(section=>section.visible).map(section=>({...section,capabilities:policy.templates[section.templateKey]?.provides??[]}))
}
export async function snapshotHasCapability(db:DatabaseExecutor,content:unknown,capability:string){return capabilitySections((await readWebsiteModulePolicy(db)).policy,content).some(section=>section.capabilities.includes(capability))}
