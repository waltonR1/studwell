// 仅列出表单已有的展示文字；默认内容、绑定值及字段结构不参与编辑。
export function templateEditorLabels(value:unknown){
 const result:Array<{path:string;key:string;target:Record<string,unknown>}>=[]
 function visit(value:unknown,path:string){
  if(!value||typeof value!=='object')return
  if(Array.isArray(value)){value.forEach((item,index)=>visit(item,path+'.'+index));return}
  for(const [key,child] of Object.entries(value)){
   if(['defaults','bindings'].includes(key))continue
   if(['label','help','title','nameLabel','itemLabel','titleFallback'].includes(key)&&typeof child==='string')result.push({path:path+'.'+key,key,target:value as Record<string,unknown>})
   else visit(child,path+'.'+key)
  }
 }
 visit(value,'editor')
 return result
}

// 按原表单分组展示文字，保留固定条目等祖先名称，避免同名控件难以区分。
export function templateEditorGroups(editor:unknown){
 if(!editor||typeof editor!=='object'||!Array.isArray((editor as {groups?:unknown}).groups))return []
 return (editor as {groups:Array<Record<string,unknown>>}).groups.map((group,index)=>({
  path:`editor.groups.${index}`,
  title:String(group.title??'表单分组'),
  entries:templateEditorLabels(group).map(entry=>{
   const names:string[]=[]
   let node:unknown=group
   for(const part of entry.path.split('.').slice(1,-1)){
    node=node&&typeof node==='object'?(node as Record<string,unknown>)[part]:undefined
    const label=node&&typeof node==='object'?(node as {label?:unknown}).label:undefined
    if(typeof label==='string'&&label!==group.title&&label!==names.at(-1))names.push(label)
   }
   return {...entry,path:`editor.groups.${index}`+entry.path.slice('editor'.length),context:names.join(' / ')}
  }),
 }))
}

// 同一个表单项目的名称、说明放在一起；用结构路径区分同名项目，不依赖可修改的显示文字。
export function templateEditorSections(entries:ReturnType<typeof templateEditorGroups>[number]['entries']){
 const sections:Array<{path:string;title:string;entries:typeof entries}>=[]
 for(const entry of entries){
  const path=entry.path.slice(0,entry.path.lastIndexOf('.'))
  let section=sections.find(item=>item.path===path)
  if(!section){
   section={path,title:entry.context||'分组设置',entries:[]}
   sections.push(section)
  }
  section.entries.push(entry)
 }
 return sections
}
