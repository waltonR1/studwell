import { siteLocales } from '#shared/schemas/admin/site-settings'
import type { WebsitePageRecord,WebsiteSectionRecord,WebsiteTemplateRecord } from '#shared/types/admin/website'
import { emptySectionContent } from '#shared/utils/website/page-layouts'
import {resolveSectionForm} from './section-form-definition'
import { initializeSectionForm } from './section-forms'

// Initialize the editable draft once, before rendering. The saved baseline stays intact.
export function initializeSectionDraft(section:WebsiteSectionRecord){
 if(section.definition)section.localized=initializeSectionForm(section.localized,resolveSectionForm(section.definition),section.definition)
}

export function sectionFromTemplate(template:WebsiteTemplateRecord):WebsiteSectionRecord|null{
 const definition=template.definition
 if(!definition)return null
 return {
  id:`new_${crypto.randomUUID()}`,templateId:template.id,templateKey:template.key,name:template.name,
  sortOrder:0,visible:true,anchorKey:`section-${crypto.randomUUID().slice(0,8)}`,contentVersion:1,structureVersion:1,
  shared:{media:definition.mediaSlots.map(({key,name})=>({key,name,mediaId:null}))},
  localized:Object.fromEntries(siteLocales.map(locale=>[locale,emptySectionContent(definition.fields)])) as WebsiteSectionRecord['localized'],definition
 }
}

export function sectionMoveTarget(page:WebsitePageRecord,index:number,delta:number):number{
 const list=page.sections,item=list[index]
 if(!item)return -1
 const group=[...list]
  .sort((a,b)=>a.sortOrder-b.sortOrder||a.id.localeCompare(b.id))
 const position=group.findIndex(section=>section.id===item.id),target=group[position+delta]
 if(!target||position<0)return -1
 return list.findIndex(section=>section.id===target.id)
}
