// 搜索只遍历模板声明的文本字段；媒体、链接、数字、布尔值不转换为正文。
import type {SectionField} from '#shared/types/website/section-template'

export function cleanSearchText(value:string):string {
    return value.replace(/<[^>]*>/g,'').replace(/\s+/gu,' ').trim()
}

export function sectionSearchText(field:SectionField,value:unknown):string {
    if(field.searchable===false||value===null||value===undefined)return ''
    if(field.kind==='text')return typeof value==='string'?cleanSearchText(value):''
    if(field.kind==='list')return Array.isArray(value)?value.map(item=>sectionSearchText(field.item,item)).filter(Boolean).join(' '):''
    if(field.kind!=='group'&&field.kind!=='tree')return ''
    if(typeof value!=='object'||Array.isArray(value))return ''
    const record=value as Record<string,unknown>
    const parts=Object.entries(field.fields).map(([key,child])=>sectionSearchText(child,record[key]))
    if(field.kind==='tree'&&Array.isArray(record.children))parts.push(...record.children.map(child=>sectionSearchText(field,child)))
    return parts.filter(Boolean).join(' ')
}
