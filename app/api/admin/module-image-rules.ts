// 读取数据库中的模块图片规则；区块规则仍由模板修订提供。
import type {ModuleImageRules} from '#shared/schemas/admin/image-rules'
import type {AdminApiClient} from '~/types/admin/api'
export function createModuleImageRulesApi(api:AdminApiClient){return {read:()=>api.read<ModuleImageRules>('media/image-rules')}}
