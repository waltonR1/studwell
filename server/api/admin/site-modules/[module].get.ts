import {defineEventHandler} from 'h3'
import {getDatabase} from '#server/db'
import {authRuntime} from '../../../runtime/auth'
import {siteModuleHandler} from '../../../http/handlers/site-module-handlers'
export default defineEventHandler(event=>siteModuleHandler(getDatabase(),authRuntime().options,'get')(event))
