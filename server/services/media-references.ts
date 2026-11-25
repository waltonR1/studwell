// 将引用标识投影为业务名称、发布状态和字段位置；不修改引用记录或删除规则。
import type {DatabaseExecutor} from '../db/transaction'
import type {MediaReference} from '#shared/types/admin/media'
import {adminContentLocale,supportedLocales} from '#shared/config/site-languages'
import {formatBeijingTime} from '#shared/utils/beijing-time'
import {websitePageKey} from '#shared/utils/website/page-layouts'
import {readMediaReferenceContext} from '../repositories/media-reference-context'
import {mediaObject,mediaArray,sectionMediaLocation} from '../policies/media-reference-labels'

export async function describeMediaReferences(db:DatabaseExecutor,refs:Array<{owner:string;field:string}>):Promise<MediaReference[]> {
    if(!refs.length)return []
    const context=await readMediaReferenceContext(db,refs.map(ref=>ref.owner))
    const localizedName=(value:unknown)=>{
        const names=mediaObject(value)
        return String(names[adminContentLocale]||Object.values(names).find(value=>typeof value==='string'&&value.trim())||'')
    }
    const pageName=(id:bigint|string)=>{
        const resource=context.resources.find(row=>String(row.id)===String(id))
        if(!resource)return '原网页记录已不存在'
        if(resource.type!=='page')return {basic:'网站标识',header:'页头维护',footer:'页脚维护'}[resource.type]
        const key=resource.key.slice(5)
        return context.menus.find(menu=>websitePageKey(menu.code)===key)?.name??'未命名网页'
    }
    const history=(active:boolean,date:Date)=>active?'当前发布':`历史发布 · ${formatBeijingTime(date,'minute')}`
    const basicLocation=(path:string)=>({logoId:'网站标志',faviconId:'浏览器图标'}[path]??'媒体内容')
    return refs.map(ref=>{
        const [domain,kind,id]=ref.owner.split(':')
        let source='其他业务记录',status='引用中',location='具体位置待核查',locationKey=ref.field,locale:string|null=null
        const splitLocale=(path:string)=>{
            const parts=path.split('.')
            if(parts[0]==='localized'&&parts[1]){locale=parts[1];return parts.slice(2).join('.')}
            return path
        }
        if(domain==='website'&&kind==='section'){
            source='原区块记录已不存在';status='来源待核查'
            const row=context.sections.find(row=>String(row.section.id)===id)
            if(row){
                source=`${pageName(row.section.resourceId)} · ${row.section.instanceName||row.definition.name||row.templateName}`;status='草稿'
                const path=splitLocale(ref.field);locationKey=path
                const localized=mediaObject(row.section.localizedContent)
                location=sectionMediaLocation(row.definition.fields,localized[adminContentLocale]??localized[locale??''],path,row.section.sharedContent,row.definition.mediaSlots)
            }
        }else if(domain==='website'&&kind==='release'){
            source='原发布记录已不存在';status='来源待核查'
            const row=context.releases.find(row=>String(row.id)===id)
            if(row){
                const resource=context.resources.find(resource=>resource.id===row.resourceId)
                source=pageName(row.resourceId);status=history(resource?.publishedReleaseId===row.id,row.createdAt)
                const match=/^sections\.(\d+)\.(.+)$/.exec(ref.field)
                if(match){
                    const section=mediaObject(mediaArray(mediaObject(row.content).sections)[Number(match[1])])
                    source+=' · '+String(section.name??'页面区块')
                    const path=splitLocale(match[2]!);locationKey=String(section.id??match[1])+':'+path
                    const localized=mediaObject(section.localized)
                    location=sectionMediaLocation(section.definition,localized[adminContentLocale]??localized[locale??''],path,section.shared,section.mediaSlots)
                }else location=basicLocation(ref.field)
            }
        }else if(domain==='website'&&kind==='draft'){
            source=pageName(id??'');status='草稿';location=basicLocation(ref.field)
        }else if(domain==='website'&&kind==='template'){
            source=context.templates.find(row=>String(row.id)===id)?.name??'原模板已不存在';status='模板资料';location='模板封面'
        }else if(domain==='website'&&kind==='seo'){
            source=pageName(id??'')+' · SEO';status='草稿';location='分享图片'
            const [code]=ref.field.split('.')
            if(supportedLocales.some(locale=>locale===code)){locale=code!;locationKey='ogMediaId'}
        }else if(domain==='website'&&kind==='config'){
            const row=context.configurations.find(row=>String(row.id)===id),match=/^seo\.(\d+)\./.exec(ref.field)
            if(row&&match){
                const entry=row.content.seo[Number(match[1])]
                if(entry){source=pageName(entry.resourceId)+' · SEO';locale=entry.locale;locationKey=entry.resourceId+':ogMediaId'}
                status=history(context.configuration?.publishedReleaseId===row.id,row.createdAt);location='分享图片'
            }
        }else if(domain==='news'){
            const draft=context.articles.find(row=>String(row.id)===id),published=context.news.find(row=>String(row.release.id)===id)
            const content=kind==='draft'?draft?.content:published?.release.content
            if(content){
                const titles=Object.fromEntries(Object.entries(content.localized).map(([locale,value])=>[locale,value.title]))
                source='新闻 · '+(localizedName(titles)||draft?.slug||'未命名文章')
                status=kind==='draft'?'草稿':history(published?.currentReleaseId===published?.release.id,published!.release.createdAt)
                const path=splitLocale(ref.field);locationKey=path
                const paragraph=/^body\.(\d+)\./.exec(path)
                location=path==='coverMediaId'?'文章封面':paragraph?`正文 · 第 ${Number(paragraph[1])+1} 段 · 图片`:'文章图片'
            }
        }
        return {owner:ref.owner,field:ref.field,source,status,location,locationKey,locale}
    })
}
