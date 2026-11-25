// 将公开 SEO 字段映射到页面元信息。
import type {PublicSeo} from '#shared/types/public/website'
export function usePublicSeo(seo:MaybeRefOrGetter<PublicSeo|undefined>){
 const origin=useRequestURL().origin
 useSeoMeta({
  title:()=>toValue(seo)?.title,
  description:()=>toValue(seo)?.description,
  robots:()=>toValue(seo)?.indexable===false?'noindex, follow':'index, follow',
  ogTitle:()=>toValue(seo)?.ogTitle||toValue(seo)?.title,
  ogDescription:()=>toValue(seo)?.ogDescription||toValue(seo)?.description,
  ogImage:()=>{const image=toValue(seo)?.ogImage;return image?new URL(image.src,origin).href:undefined},
 })
}
