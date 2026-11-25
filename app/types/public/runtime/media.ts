// 定义公开端图片源、替代文本和展示配置的共用类型。
import type { LocalizedContent } from '~/types/public/runtime/content'
import type {ImagePresentation,ImageRule} from '#shared/types/image-presentation'

// API 返回当前语言 alt，本地内容可携带多语言描述。
export interface DisplayImage {
  src: string
  alt: string | LocalizedContent<string>
  width?: number
  height?: number
  srcSet?: string
  presentation?:ImagePresentation
  imagePreset?:ImageRule
}
