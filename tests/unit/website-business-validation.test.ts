import {expect,it,vi} from 'vitest'
import type {DatabaseExecutor} from '../../server/db/transaction'
import {validateBusinessSectionContent} from '../../server/services/website-business-validation'
vi.mock('../../server/repositories/website-module-policy',()=>({readWebsiteModulePolicy:async()=>({version:1,policy:{enabled:{news:true,careers:true,inquiries:true},pages:{},templates:{'customer.feed':{modules:['news'],provides:['news.list'],requires:[]}}}})}))
const db={} as DatabaseExecutor
const valid={copy:{all:'All',empty:'Empty'},data:{pageSize:12,showFilters:true,showDate:true,showSummary:true}}
const content={sections:[{templateKey:'customer.feed',visible:true,localized:{en:valid,fr:{copy:{all:'',empty:''},data:{...valid.data,pageSize:0}}}}]}
it('业务校验只要求启用语言，停用语言可继续保留草稿',async()=>{await expect(validateBusinessSectionContent(db,content,['en'])).resolves.toBeUndefined()})
it('自定义代称仍执行已声明能力的业务校验',async()=>{await expect(validateBusinessSectionContent(db,content,['fr'])).rejects.toMatchObject({code:'INVALID_INPUT'})})
