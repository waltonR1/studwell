export type PreviewFrameState='ready'|'failed'
export function previewFrameState(message:unknown):PreviewFrameState|undefined{
 if(!message||typeof message!=='object')return
 const value=message as {type?:unknown;state?:unknown}
 if(value.type==='website-preview-state'&&(value.state==='ready'||value.state==='failed'))return value.state
}
export function notifyPreviewFrame(state:PreviewFrameState){
 if(typeof window==='undefined'||window.parent===window)return
 window.parent.postMessage({type:'website-preview-state',state},window.location.origin)
}
