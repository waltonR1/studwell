import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {computed,ref} from 'vue'
import type {SiteLanguages} from '../../shared/config/site-languages'
import type {ApiResponse} from '../../shared/types/api'
import {useSiteLanguages} from '../../app/composables/public/runtime/useSiteLanguages'

const mocks=vi.hoisted(()=>({fetch:vi.fn()}))
vi.mock('../../app/api/public/http',()=>({usePublicApiFetch:mocks.fetch}))
beforeEach(()=>{
 vi.clearAllMocks()
 vi.stubGlobal('computed',computed)
 vi.stubGlobal('createError',(value:object)=>Object.assign(new Error('Configuration error'),value))
})
afterEach(()=>vi.unstubAllGlobals())

it('首次读取和再次导航各执行一次请求，立即使用新的公开语言范围',async()=>{
 const data=ref<ApiResponse<SiteLanguages>>()
 const error=ref(null)
 const languages:SiteLanguages={enabledLocales:['zh','en'],defaultLocale:'zh'}
 const execute=vi.fn(async()=>{data.value={success:true,data:structuredClone(languages),requestId:'test'}})
 mocks.fetch.mockReturnValue({data,error,execute})
 const first=useSiteLanguages()
 await first.ready
 expect(first.languages.value).toEqual(languages)
 expect(execute).toHaveBeenCalledTimes(1)
 expect(mocks.fetch).toHaveBeenCalledWith('site-languages',expect.objectContaining({immediate:false}))
 languages.enabledLocales=['zh']
 const next=useSiteLanguages()
 await next.ready
 expect(execute).toHaveBeenCalledTimes(2)
 expect(next.languages.value?.enabledLocales).toEqual(['zh'])
})

it('配置读取失败时拒绝放行，不回退为全部系统语言',async()=>{
 mocks.fetch.mockReturnValue({data:ref(undefined),error:ref(null),execute:async()=>{}})
 await expect(useSiteLanguages().ready).rejects.toMatchObject({statusCode:503})
})
