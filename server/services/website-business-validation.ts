// 按区块能力校验关联业务内容，不依赖前端模板实现。
import type {SupportedLocale} from '#shared/config/site-languages'
// 业务内容约束按能力执行，通用页面校验不识别业务模板代称。
import type {DatabaseExecutor} from '../db/transaction'
import {newsListSectionSchema} from '#shared/schemas/admin/news'
import {linkTargetSchema} from '#shared/schemas/website/link-target'
import {ApiError} from '../core/errors'
import {readWebsiteModulePolicy} from '../repositories/website-module-policy'
import {capabilitySections} from './website-capabilities'
import {parseInput} from '../core/validation'
export async function validateBusinessSectionContent(db:DatabaseExecutor,content:unknown,locales:readonly SupportedLocale[]){
 const {policy}=await readWebsiteModulePolicy(db)
 for(const section of capabilitySections(policy,content)){
  const localized=(section as unknown as {localized:Record<string,unknown>}).localized
  for(const locale of locales){
   const value=localized[locale]
   if(section.capabilities.includes('news.list'))await parseInput(newsListSectionSchema,value)
   if(section.capabilities.includes('content.links'))validateLinkCards(value)
  }
 }
}

const invalid=(message:string)=>new ApiError('INVALID_INPUT',[{path:'content',message}])
function validateLinkCards(raw:unknown){
 const cards=(raw as {data?:{cards?:Array<{id:string;resourceId:unknown}>}})?.data?.cards??[]
 const ids=new Set<string>()
 for(const card of cards){
  if(ids.has(card.id))throw invalid('入口卡片标识不能重复。')
  ids.add(card.id)
  if(!linkTargetSchema.safeParse(card.resourceId).success)throw invalid('请选择有效的跳转目标。')
 }
}
