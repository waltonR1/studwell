import referenceSystem from './reference/system.json'
import {inquirySettingsSchema} from '#shared/schemas/admin/inquiry-settings'
import {adminDictionaries,adminDictionaryItems,customerInquirySettings} from '../../server/db/schema'
import {eq} from 'drizzle-orm'
import {adminUsers, websiteTemplates, websiteTemplateRevisions} from '../../server/db/schema'
import type {Database} from '../../server/db/transaction'
import {withEntityIds} from '../../server/db/allocate-entity-id'
import {websiteTemplateCatalog, websiteTemplateSamples} from './reference/template-catalog'
import {lockSiteConfig} from '../../server/repositories/website-site-config'

// 初装默认模板只补缺失目录；不比较或覆盖数据库中的配置和修订。
export async function seedWebsiteTemplates(db:Database){return db.transaction(async tx=>{
 await lockSiteConfig(tx)
 const [actor]=await tx.select().from(adminUsers).where(eq(adminUsers.isRoot,true))
 if(!actor?.enabled||actor.deletedAt)throw new Error('DB_TEMPLATE_ROOT_REQUIRED')
 const existing=new Set((await tx.select({key:websiteTemplates.key}).from(websiteTemplates)).map(row=>row.key))
 const created:string[]=[]
 for(const definition of websiteTemplateCatalog){
  if(existing.has(definition.key))continue
  const row=await withEntityIds(tx,'website_templates',{key:definition.key,name:definition.name,description:'',previewSample:websiteTemplateSamples[definition.key]??null,enabledForNew:true,createdBy:actor.id,updatedBy:actor.id})
  await tx.insert(websiteTemplates).values(row)
  await tx.insert(websiteTemplateRevisions).values({templateId:row.id,version:1,definition})
  existing.add(definition.key);created.push(definition.key)
 }
 return {created}
})}

// Fixed framework regression defaults; never used by the actual site's initialization.
import {websiteLanguageConfig,websiteModulePolicy,websiteImageRules,websiteRenderers,adminMenus} from '../../server/db/schema'
import type {DatabaseTransaction} from '../../server/db/transaction'
import {defaultSiteLanguages} from '#shared/config/site-languages'
import {websiteModulePolicySchema} from '#shared/schemas/website/module-policy'
import policy from './reference/module-policy.json'
import renderers from './reference/renderers.json'
import pages from './reference/pages.json'
export async function seedReferenceSystem(tx:DatabaseTransaction){
 await seedReferenceBusiness(tx)
 await tx.update(websiteLanguageConfig).set({languages:defaultSiteLanguages})
 await tx.insert(websiteModulePolicy).values({id:1,policy:websiteModulePolicySchema.parse(policy)}).onDuplicateKeyUpdate({set:{policy:websiteModulePolicySchema.parse(policy)}})
 await tx.insert(websiteImageRules).values({id:1,rules:referenceSystem.imageRules}).onDuplicateKeyUpdate({set:{rules:referenceSystem.imageRules}})
 await tx.delete(websiteRenderers)
 await tx.insert(websiteRenderers).values(renderers.map(row=>({...row,scope:row.scope as 'public'|'preview'})))
 let parent=(await tx.select().from(adminMenus)).find(row=>row.code==='page_maintenance')
 if(!parent){await tx.insert(adminMenus).values(await withEntityIds(tx,'admin_menus',{code:'page_maintenance',name:'页面维护',iconKey:'globe',pageKey:null,parentId:null,sortOrder:50,visible:true}));parent=(await tx.select().from(adminMenus)).find(row=>row.code==='page_maintenance')!}
 await tx.delete(adminMenus).where(eq(adminMenus.pageKey,'website_page'))
 await tx.insert(adminMenus).values(await withEntityIds(tx,'admin_menus',pages.map(page=>({...page,parentId:parent!.id,pageKey:'website_page' as const,iconKey:'file-text',visible:true}))))
}

// Fixed optional business data for regression fixtures; excluded from production initialization.
export async function seedReferenceBusiness(tx:DatabaseTransaction,{dictionaryItems=false}:{dictionaryItems?:boolean}={}){
 for(const preset of referenceSystem.dictionaries){
  let dictionary=(await tx.select().from(adminDictionaries).where(eq(adminDictionaries.code,preset.code)))[0]
  if(!dictionary){const row=await withEntityIds(tx,'admin_dictionaries',{code:preset.code,name:preset.name,description:preset.description,enabled:true});await tx.insert(adminDictionaries).values(row);dictionary=(await tx.select().from(adminDictionaries).where(eq(adminDictionaries.code,preset.code)))[0]!}
  if(!dictionaryItems)continue
  const existing=await tx.select().from(adminDictionaryItems).where(eq(adminDictionaryItems.dictionaryId,dictionary.id))
  const missing=preset.items.flatMap(([code,name],index)=>existing.some(row=>row.code===code)?[]:[{dictionaryId:dictionary.id,code:code!,name:name!,sortOrder:(index+1)*100}])
  if(missing.length)await tx.insert(adminDictionaryItems).values(await withEntityIds(tx,'admin_dictionary_items',missing))
 }
 await tx.update(customerInquirySettings).set({settings:inquirySettingsSchema.parse(referenceSystem.inquirySettings)})
}
