// Numeric entity IDs and explicitly registered resource/page keys only; no wildcard paths.
export function matchesAdminPath(pattern:string,path:string){
 const expected=pattern.split('/'),actual=path.split('/')
 return expected.length===actual.length&&expected.every((part,index)=>{
  const value=actual[index]??''
  if(part===':id'||part===':releaseId')return /^[1-9]\d{0,19}$/.test(value)
  if(part===':key'&&pattern==='/api/admin/website-templates/:key/sample')return value.length<=100&&/^[a-z][a-zA-Z0-9_-]*(?:\.[a-zA-Z0-9_-]+)+$/.test(value)
  if(part===':key')return pattern.startsWith('/api/admin/website-resources/')?/^(site\.(basic|header|footer)|page\.[a-z][a-z0-9_-]{0,63})$/.test(value):pattern.startsWith('/api/admin/pages/')&&/^[a-z][a-z0-9_-]{0,63}$/.test(value)
  return part===value
 })
}
