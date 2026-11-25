// 路由已校验站点公开语言；非法语言显式拒绝，不回退到安装默认语言。
import {supportedLocales} from '#shared/config/site-languages'
import type { ContentLocale } from '~/types/public/runtime/content'
export function resolveContentLocale(locale: string): ContentLocale {
  if(!supportedLocales.includes(locale as ContentLocale))throw new Error('Unsupported content locale: '+locale)
  return locale as ContentLocale
}
