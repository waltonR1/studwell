// 同一业务位置的多语言记录合并展示；保留各历史版本及不同图片位置的区别。
import type {MediaReference} from '#shared/types/admin/media'
import {adminContentLocale,supportedLanguageCatalog} from '#shared/config/site-languages'

export function groupMediaReferences(references:MediaReference[]) {
    const groups=new Map<string,{key:string;source:string;status:string;location:string;locales:string[]}>()
    for(const reference of references){
        const key=reference.owner+'\0'+reference.locationKey
        let group=groups.get(key)
        if(!group){group={key,source:reference.source,status:reference.status,location:reference.location,locales:[]};groups.set(key,group)}
        if(reference.locale&&!group.locales.includes(reference.locale))group.locales.push(reference.locale)
    }
    const catalog=[...supportedLanguageCatalog].sort((a,b)=>Number(b.code===adminContentLocale)-Number(a.code===adminContentLocale))
    return [...groups.values()].map(group=>({...group,languages:group.locales.length
        ? [...group.locales].sort((a,b)=>catalog.findIndex(item=>item.code===a)-catalog.findIndex(item=>item.code===b)).map(locale=>catalog.find(item=>item.code===locale)?.adminName??locale).join('、')
        : '各语言共用'}))
}
