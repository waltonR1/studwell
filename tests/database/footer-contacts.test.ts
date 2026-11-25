// 当前页脚合同直接保存多语言联系方式，历史发布与草稿独立。
import {beforeAll,afterAll,it,expect} from 'vitest'
import {setupTestDatabase,cleanTestDatabase} from './support'
import {seedRoot} from '../../scripts/database/seed/system'
import {siteSettingsRepository} from '../../server/repositories/site-settings'
import {websiteResourceRepository as resources} from '../../server/repositories/website-resources'
import {createSiteSettings,emptySiteText} from '../../shared/utils/admin/site-settings'
import {siteFooterSchema} from '../../shared/schemas/admin/site-settings'
let client:Awaited<ReturnType<typeof setupTestDatabase>>,actor:bigint
beforeAll(async()=>{client=await setupTestDatabase();actor=BigInt((await seedRoot(client.database,'Footer baseline fixture 8436!')).id)})
afterAll(async()=>{if(client)await cleanTestDatabase(client)})

it('初始结构往返保存通用联系方式，后续草稿修改不改变发布快照',async()=>{
    const db=client.database,content=createSiteSettings()
    content.footer.contacts=[
        {id:'sales',kind:'email',visible:true,label:{...emptySiteText(),en:'Sales',zh:'销售'},value:{...emptySiteText(),en:'sales@example.com',zh:'sales-zh@example.com'}},
        {id:'phone',kind:'phone',visible:true,label:{...emptySiteText(),en:'Telephone'},value:{...emptySiteText(),en:'+86 123'}},
        {id:'address',kind:'text',visible:true,label:{...emptySiteText(),fr:'Adresse'},value:{...emptySiteText(),fr:'Adresse publiée'}},
    ]
    await siteSettingsRepository.insert(db,content,actor)
    const resource=(await resources.find(db,'site.footer'))!
    const history=await resources.append(db,{resourceId:resource.id,draftVersion:1,content:content.footer,createdBy:actor})
    await resources.activate(db,resource.id,history.id)
    expect(siteFooterSchema.parse((await siteSettingsRepository.find(db))!.content.footer).contacts).toEqual(content.footer.contacts)
    expect((await siteSettingsRepository.find(db))!.content.footer.contacts).toEqual(content.footer.contacts)
    const changed=structuredClone(content.footer)
    changed.contacts[0]!.value.en='new@example.com'
    await siteSettingsRepository.update(db,resource.id,{section:'footer',version:1,content:changed},actor)
    expect((await resources.release(db,history.id,resource.id))!.content).toEqual(content.footer)
    expect((await resources.find(db,'site.footer'))!.publishedReleaseId).toBe(history.id)
})
