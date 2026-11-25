// 将 HTTP Range 头解析为媒体字节范围或协议错误。
import type {MediaByteRange} from '../core/media-range'
// HTTP语法只在适配层解析，业务层仅处理字节范围。
export function parseMediaRange(header: string | undefined): MediaByteRange | undefined {
    if(header===undefined)return undefined
    const match=/^bytes=(\d*)-(\d*)$/.exec(header)
    if(!match || !match[1] && !match[2])return {invalid:true}
    const range:MediaByteRange=match[1]?{start:Number(match[1]),end:match[2]?Number(match[2]):undefined}:{suffix:Number(match[2])}
    if(Object.values(range).some(value=>value!==undefined && !Number.isSafeInteger(value)))return {invalid:true}
    return range
}
