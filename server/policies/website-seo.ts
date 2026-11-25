// 按资源和语言投影公开 SEO；缺失条目禁止索引，不读取数据库。
import type {WebsiteSeoEntry} from '#shared/types/website/site-config'
import type {PublicSeo} from '#shared/types/public/website'

export function seoFor(rows:WebsiteSeoEntry[],resourceId:string,locale:WebsiteSeoEntry['locale']):PublicSeo{
 const row=rows.find(row=>row.resourceId===resourceId&&row.locale===locale)
 return row?{title:row.title,description:row.description,indexable:row.indexable,ogTitle:row.ogTitle,ogDescription:row.ogDescription}:{title:'',description:'',indexable:false}
}
