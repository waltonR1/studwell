// 显式升级一个区块草稿的模板修订，保留当前发布快照。
import {getDatabase} from '#server/db'
import {authRuntime} from '../../../../../../runtime/auth'
import {websitePageHandlers} from '../../../../../../http/handlers/website-page-handlers'
export default defineEventHandler(event=>websitePageHandlers(getDatabase(),authRuntime().options).upgrade(event))
