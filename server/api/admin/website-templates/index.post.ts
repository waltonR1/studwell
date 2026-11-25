// 登记已部署组件及首次模板合同。
import {getDatabase} from '#server/db'
import {authRuntime} from '../../../runtime/auth'
import {websiteTemplateHandlers} from '../../../http/handlers/website-template-handlers'
export default defineEventHandler(event=>websiteTemplateHandlers(getDatabase(),authRuntime().options).register(event))
