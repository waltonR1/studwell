import {inspectMediaFile} from '../../server/policies/media-file'
// Some original JPEGs contain a trailer after their EOI marker. Strip only that
// non-image trailer for the independent import copy; never modify source files.
export function prepareImportedMedia(bytes:Buffer,filename:string,mime:string){
 const info=inspectMediaFile(bytes,filename,mime)
 if(mime!=='image/jpeg'||bytes[0]!==255||bytes[1]!==216)return {bytes,info,normalized:false}
  const end=bytes.lastIndexOf(Buffer.from([255,217]))
  if(end<2||end+2===bytes.length)return {bytes,info,normalized:false}
  const copy=bytes.subarray(0,end+2)
  return {bytes:copy,info:inspectMediaFile(copy,filename,mime),normalized:true}
}
