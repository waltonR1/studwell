// 新安装直接保存当前搜索字段合同，不再依赖旧快照转换。
import {afterAll,beforeAll,expect,it} from 'vitest'
import {setupTestDatabase,cleanTestDatabase} from './support'
import {seedRoot} from '../../scripts/database/seed/system'
import {seedWebsiteTemplates} from '../fixtures/reference-seed'
import {websiteTemplateRevisions} from '../../server/db/schema'
import {sectionSearchText} from '../../server/policies/search-text'

let client:Awaited<ReturnType<typeof setupTestDatabase>>
beforeAll(async()=>{client=await setupTestDatabase()})
afterAll(async()=>{if(client)await cleanTestDatabase(client)})

it('初始模板修订已声明技术字段不参与搜索，正文及型号正常收录',async()=>{
    await seedRoot(client.database,'Search baseline fixture Aurora 8462!')
    await seedWebsiteTemplates(client.database)
    const revision=(await client.database.select().from(websiteTemplateRevisions)).find(row=>row.definition.key==='product.cement_standards')!
    expect(revision).toBeTruthy()
    const text=sectionSearchText(revision.definition.fields,{
        copy:{standardsTitle:'Standards'},
        data:{standards:[{id:'technical-standard-id',country:'Europe',code:'EN 197',models:[{id:'technical-model-id',code:'CEM I',label:'Portland cement'}]}]},
    })
    for(const phrase of ['Standards','Europe','EN 197','CEM I','Portland cement'])expect(text).toContain(phrase)
    expect(text).not.toContain('technical-')
})
