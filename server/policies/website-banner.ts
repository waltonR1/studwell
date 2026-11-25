// 判断发布区块是否包含横幅视频，不读取媒体仓储。
export function hasBannerVideo(path:string|undefined,content:unknown){
 if(!path)return false
 const value=path.split('.').filter(Boolean).reduce<unknown>((current,segment)=>
  current&&typeof current==='object'?(current as Record<string,unknown>)[segment]:undefined,content)
 return !!(value&&typeof value==='object'&&'mediaId' in value&&(value as {mediaId?:string|null}).mediaId)
}
