// 管理端 DELETE /api/admin/media/[id] 路由入口，衔接请求处理与业务服务。
import { defineEventHandler } from 'h3';
import { mediaRuntime } from '../../../runtime/media';
export default defineEventHandler(event => mediaRuntime().remove(event));
