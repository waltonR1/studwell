// 从字段合同和当前条目值生成业务位置，不向业务界面回退输出内部路径。
import {publishedFieldDefinition} from '#shared/schemas/website/section-template'
import type {SectionField} from '#shared/types/website/section-template'

export const mediaObject=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}
export const mediaArray=(value:unknown):unknown[]=>Array.isArray(value)?value:[]

function itemName(field:SectionField,value:unknown,index:number):string {
    if(field.kind==='group'||field.kind==='tree'){
        const values=mediaObject(value)
        const title=Object.entries(field.fields).find(([,child])=>child.kind==='text'&&child.searchable!==false&&child.required)
        if(title&&typeof values[title[0]]==='string'&&String(values[title[0]]).trim())return String(values[title[0]])
        const media=Object.values(field.fields).find(child=>child.kind==='media')
        if(media)return media.mediaKind==='video'?`第 ${index+1} 个视频`:`第 ${index+1} 张图片`
    }
    return `第 ${index+1} 项`
}

export function sectionMediaLocation(definition:unknown,content:unknown,path:string,shared?:unknown,slots?:unknown):string {
    if(path.startsWith('shared.media.')){
        const index=Number(path.split('.')[2]),item=mediaObject(mediaArray(mediaObject(shared).media)[index])
        const slot=mediaArray(slots).map(mediaObject).find(slot=>slot.key===item.key)
        return typeof slot?.name==='string'?slot.name:'区块公共图片'
    }
    let field:SectionField
    try {field=publishedFieldDefinition(definition)} catch {return '图片位置待核查'}
    let value=content
    const labels:string[]=[]
    for(const part of path.split('.')){
        if(part==='mediaId')break
        if(field.kind==='list'&&/^\d+$/.test(part)){
            value=mediaArray(value)[Number(part)];field=field.item
            labels.push(itemName(field,value,Number(part)));continue
        }
        if(field.kind==='tree'&&part==='children'){
            value=mediaObject(value).children;continue
        }
        if(field.kind==='tree'&&/^\d+$/.test(part)){
            value=mediaArray(value)[Number(part)];labels.push(itemName(field,value,Number(part)));continue
        }
        if(field.kind!=='group'&&field.kind!=='tree')return labels.join(' · ')||'图片位置待核查'
        const child:SectionField|undefined=field.fields[part]
        if(!child)return labels.join(' · ')||'图片位置待核查'
        value=mediaObject(value)[part];field=child
        if(part==='copy'||part==='data')continue
        if(child.kind==='media'&&labels.at(-1)?.includes('图片'))continue
        labels.push(child.label)
    }
    return labels.join(' · ')||'区块图片'
}
