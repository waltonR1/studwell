// 从发布数据投影媒体快照，不访问文件系统。
import {createHash} from 'node:crypto'
export function snapshotMedia(content:unknown):Array<{field:string;mediaId:bigint}>{
 const result:Array<{field:string;mediaId:bigint}>=[]
 function visit(v:unknown,path:string){if(Array.isArray(v)){v.forEach((x,i)=>visit(x,`${path}.${i}`));return}if(!v||typeof v!=='object')return;for(const [key,value] of Object.entries(v)){const p=path?`${path}.${key}`:key;if(/^(logoId|faviconId|mediaId)$/.test(key)&&typeof value==='string'&&/^\d{19}$/.test(value))result.push({field:p.length<=80?p:createHash('sha256').update(p).digest('hex'),mediaId:BigInt(value)});else visit(value,p)}}
 visit(content,'');return result
}
