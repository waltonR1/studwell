// 定义栏目横幅共用的主题图片与视频数据。
import type {DisplayImage} from '../../runtime/media'

export interface ColumnHeroData {
  topics: Array<{slug: string; image?: DisplayImage; labelKey?: string; summaryKey?: string}>
  heroVideo?: string | null
}
