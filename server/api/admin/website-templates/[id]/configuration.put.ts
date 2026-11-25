// 保存受限配置并追加模板修订，不覆盖已有区块绑定。
import {getDatabase} from '#server/db'
import {authRuntime} from '../../../../runtime/auth'
import {websiteTemplateHandlers} from '../../../../http/handlers/website-template-handlers'
export default defineEventHandler(event=>websiteTemplateHandlers(getDatabase(),authRuntime().options).revise(event))
