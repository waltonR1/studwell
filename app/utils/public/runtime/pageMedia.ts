// 将发布媒体引用转换为组件使用的图片和视频数据。
import type {PublicImageReference, PublicMedia} from '#shared/types/public/website'
import type {DisplayImage} from '~/types/public/runtime/media'

export function publicImage(reference: PublicImageReference, media: Record<string, PublicMedia>, alt: DisplayImage['alt'] = ''): DisplayImage | null {
  if (reference.mediaId === null) return null
  const asset = media[reference.mediaId]
  if (!asset || asset.kind !== 'image') throw new Error('Published image is unavailable')
  return {src: asset.src, alt, ...(reference.imagePreset ? {imagePreset: reference.imagePreset} : {}), ...(reference.presentation ? {presentation: reference.presentation} : {})}
}

export function publicVideo(reference: {mediaId: string | null}, media: Record<string, PublicMedia>): string | null {
  if (reference.mediaId === null) return null
  const asset = media[reference.mediaId]
  if (!asset || asset.kind !== 'video') throw new Error('Published video is unavailable')
  return asset.src
}
