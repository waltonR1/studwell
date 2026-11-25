// 登记详情目标提供者，按发布区块能力匹配动态路由并验证目标存在。
import {snapshotHasCapability} from './website-capabilities'
import {publicNewsRepository} from '../repositories/public-news'
import type {DatabaseExecutor} from '../db/transaction'

const providers=[{
 type:'news',parameter:'slug',capability:'news.article',
 async exists(db:DatabaseExecutor,slug:string){return Boolean(await publicNewsRepository.detail(db,slug))},
}]
export async function findDetailProvider(db:DatabaseExecutor,parameter:string,content:unknown){for(const provider of providers)if(provider.parameter===parameter&&await snapshotHasCapability(db,content,provider.capability))return provider}
