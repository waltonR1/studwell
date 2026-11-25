// 集合字段的局部编辑事务：草稿、媒体基线、确认取消和校验随组件作用域释放，不写入全局 store。
import {computed,ref,watch,inject,onMounted,onBeforeUnmount} from 'vue'
import {storeToRefs} from 'pinia'
import type {MediaSelection} from '#shared/types/image-presentation'
import {assignSharedImage} from '~/utils/admin/website/shared-image'
import {useAdminNavigationTargetsStore} from '~/stores/admin/navigation-targets'
import {linkTargetLabel} from '#shared/utils/admin/link-target'
import type {AdminConfirmation} from '~/types/admin/interaction'
import {changeFormList,changeFormValue,fieldPath,valueAt} from '~/utils/admin/website/section-forms'
import {editBannerImage} from '~/utils/admin/website/section-editors'
import {
 beginCollectionEdit,collectionColumnField,collectionEditorRows,collectionEditorStructureError,
 collectionParentOptions,finishCollectionEdit,moveCollectionRow,removeCollectionRow,
 type CollectionEdit,type CollectionEditorRow,
} from '~/utils/admin/website/collection-editor'
import type {BannerImagesField,CollectionField,ListAction,SectionFormProps,ValueField} from '~/types/admin/website-section-forms'
import type {LocalizedSections} from '~/types/admin/website-section-editors'

interface CollectionTableRow extends CollectionEditorRow {
  id:string
  name:string
  visible:boolean
}

type Props=SectionFormProps&{field:CollectionField;basePath:string;listTitle?:string;listDescription?:string}
type Events={
 (event:'update:modelValue',value:LocalizedSections):void
 (event:'update:media',key:string,value:MediaSelection):void
 (event:'validation',message:string):void
}
export function useCollectionTableEditor(props:Props,emit:Events){
const store=useAdminNavigationTargetsStore(),{navigationTargets:linkTargets,navigationTargetsError:linkTargetsError,navigationTargetsPending:linkTargetsPending}=storeToRefs(store)
const resolvedField=computed<CollectionField>(()=>({...props.field,path:fieldPath(props.field,props.basePath)}))
onMounted(()=>{
 const fields=[...(resolvedField.value.fields??[]),...(resolvedField.value.tree?.levels.flatMap(level=>level.fields)??[]),...(resolvedField.value.fixedRows??[]).flatMap(row=>row.fields)]
 if(fields.some(field=>field.kind==='link'))void store.loadNavigationTargets()
})
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T
const ask=inject<(request:AdminConfirmation)=>Promise<boolean>>('admin-confirm')!
const collapsed=ref<string[]>([]),error=ref(''),editor=ref<CollectionEdit|null>(null)
const createLevel=ref(0),createParentKey=ref('')
const treeInitiallyCollapsed=ref(false)
const localErrors=ref<Record<string,string>>({}),sharedDraft=ref(clone(props.shared))
let baseline='',sharedBaseline=''
const rows=computed(()=>{
 try{return collectionEditorRows(props.modelValue,props.locale,resolvedField.value)}catch{return []}
})
const rootRows=computed(()=>rows.value.filter(row=>row.parent===null))
watch(rows,()=>{
 if(treeInitiallyCollapsed.value||!resolvedField.value.tree||!rootRows.value.length)return
 if(resolvedField.value.tree.defaultExpanded!==true)collapsed.value=rootRows.value.map(row=>row.key)
 treeInitiallyCollapsed.value=true
},{immediate:true})
const structureError=computed(()=>collectionEditorStructureError(props.modelValue,resolvedField.value))
const search=ref(''),visibility=ref('')
const writable=computed(()=>!props.disabled&&!props.readonly)
const visibleRows=computed(()=>rows.value.filter(row=>{
 let parent=row.parent
 while(parent!==null){if(collapsed.value.includes(parent))return false;parent=rows.value.find(item=>item.key===parent)?.parent??null}
 return true
}))
const tableRows=computed<CollectionTableRow[]>(()=>visibleRows.value.map(row=>({...row,id:row.key,name:row.title,visible:true})))
const activeRow=computed(()=>editor.value?collectionEditorRows(editor.value.localized,editor.value.locale,resolvedField.value).find(row=>row.key===editor.value!.key):undefined)
const parents=computed(()=>editor.value?collectionParentOptions(editor.value,resolvedField.value):[])
const editorLabel=computed(()=>activeRow.value?.itemLabel??resolvedField.value.itemLabel)
const createLevelOptions=computed(()=>resolvedField.value.tree?.levels.flatMap((level,index)=>resolvedField.value.tree!.maxDepth!==undefined&&index>resolvedField.value.tree!.maxDepth?[]:[{value:String(index),label:level.itemLabel,disabled:index>0&&!rows.value.some(row=>row.depth===index-1)}])??[])
function parentOptions(level:number){return level===0?[]:rows.value.filter(row=>row.depth===level-1).map(row=>({value:row.key,label:row.title}))}
const createParentOptions=computed(()=>parentOptions(createLevel.value))
const createParentLabel=computed(()=>resolvedField.value.tree?.levels[Math.max(0,createLevel.value-1)]?.itemLabel??'上级')
const dirty=computed(()=>!!editor.value&&!props.readonly&&JSON.stringify({localized:editor.value.localized,parent:editor.value.parent,shared:sharedDraft.value})!==baseline)
const localMessage=computed(()=>Object.values(localErrors.value).join(' '))
const pendingEditMessage=computed(()=>editor.value&&!props.readonly?'请先确认或取消条目编辑。':'')
watch(pendingEditMessage,value=>emit('validation',value))
onBeforeUnmount(()=>emit('validation',''))

function hasChildren(row:CollectionEditorRow){return rows.value.some(item=>item.parent===row.key)}
function toggle(key:string){collapsed.value=collapsed.value.includes(key)?collapsed.value.filter(item=>item!==key):[...collapsed.value,key]}
function canMove(row:CollectionEditorRow,direction:'up'|'down'){
 if(props.field.fixedRows||(resolvedField.value.tree&&row.parent===null&&resolvedField.value.tree.roots==='single'))return false
 const siblings=rows.value.filter(item=>item.parent===row.parent)
 return direction==='up'?row.index>0:row.index<siblings.length-1
}
function cell(row:CollectionEditorRow,key:string){
 const field=collectionColumnField(row,key)
 const value=field?valueAt(props.modelValue[props.locale],fieldPath(field,row.base)):undefined
 const mediaId=field?.kind==='media'?(value as {mediaId?:string|null}|undefined)?.mediaId:undefined
 const text=field?.kind==='select'?field.options?.find(option=>option.value===value)?.label:
  field?.kind==='link'?linkTargetLabel(value,linkTargets.value,props.locale):Array.isArray(value)?`${value.length} 条`:value
 return {mediaId,options:field?.kind==='select'?field.options:undefined,value:typeof value==='string'?value:'',checked:field?.kind==='boolean'?(value??field.defaultChecked)===true:undefined,text:text===undefined||text===null||text===''?'—':String(text)}
}
function changeCell(row:CollectionEditorRow,key:string,value:boolean|string){
 const field=collectionColumnField(row,key)
 if(!field||!writable.value||editor.value||structureError.value)return
 if(field.kind==='select'){
  if(!props.field.columns?.some(column=>column.field===key&&column.editable)||!field.options?.some(option=>option.value===value))return
 }else if(field.kind!=='boolean'||typeof value!=='boolean')return
 try{
  emit('update:modelValue',changeFormValue(props.modelValue,props.locale,field,row.base,value,row.identity))
  error.value=''
 }catch(cause){error.value=cause instanceof Error?cause.message:'条目更新失败。'}
}
function open(key:string|null,parent:string|null=null,level=0){
 if((key===null&&!writable.value)||(props.disabled&&!props.readonly))return
 try{
  editor.value=beginCollectionEdit(props.modelValue,props.locale,props.definition,resolvedField.value,key,parent)
  if(key===null){createLevel.value=level;createParentKey.value=parent??''}
  else if(editor.value.parent)collapsed.value=collapsed.value.filter(item=>item!==editor.value!.parent)
  sharedDraft.value=clone(props.shared);sharedBaseline=JSON.stringify(props.shared)
  baseline=JSON.stringify({localized:editor.value.localized,parent:editor.value.parent,shared:sharedDraft.value})
  localErrors.value={};error.value=''
 }catch(cause){error.value=cause instanceof Error?cause.message:'条目无法打开。'}
}
function beginCreate(){open(null)}
async function selectCreateLevel(value:string){
 const level=Number(value),parent=level>0?parentOptions(level)[0]?.value??null:null
 if(level>0&&!parent)return
 if(level!==createLevel.value&&await canDiscardEntry())open(null,parent,level)
}
async function selectCreateParent(value:string){
 if(value!==createParentKey.value&&await canDiscardEntry())open(null,value,createLevel.value)
}
function canDiscardEntry(){
 return !dirty.value||ask({title:'放弃条目修改？',message:'尚未确认的条目输入将被放弃。',confirmLabel:'放弃修改',cancelLabel:'继续编辑'})
}
async function close(){
 if(!await canDiscardEntry())return
 editor.value=null;localErrors.value={};emit('validation','')
}
function applyLocal(key:string,operation:(value:LocalizedSections)=>LocalizedSections){
 if(!editor.value||!writable.value)return
 delete localErrors.value.confirm
 try{editor.value.localized=operation(editor.value.localized);delete localErrors.value[key]}
 catch(cause){localErrors.value[key]=cause instanceof Error?cause.message:'请检查条目内容。'}
}
function change(field:ValueField,base:string,value:unknown){
 applyLocal(fieldPath(field,base),localized=>changeFormValue(localized,editor.value!.locale,field,base,value,activeRow.value?.identity))
}
async function list(field:CollectionField|ValueField,base:string,index:number,action:ListAction){
 if(!editor.value||!writable.value)return
 if(action==='remove'&&!await ask({title:'移除条目？',message:'移除此条目，确认弹窗后写入页面草稿。',confirmLabel:'移除',cancelLabel:'取消'}))return
 applyLocal(field.path,localized=>changeFormList(localized,editor.value!.locale,props.definition,field,base,index,action))
}
function media(key:string,value:MediaSelection){
 if(!writable.value)return
 delete localErrors.value.confirm
 const slot=sharedDraft.value.media.find(slot=>slot.key===key)
 if(slot)assignSharedImage(slot,value)
}
function banner(field:BannerImagesField,index:number|null,value:string|null){
 applyLocal('banner',localized=>editBannerImage(localized,editor.value!.locale,index,props.mediaKey??'banner',value,field))
}
function confirm(){
 if(!editor.value||!writable.value||localMessage.value)return
 try{
  if(sharedBaseline!==JSON.stringify(props.shared))throw new Error('页面媒体已变化，请重新打开条目。')
  const addedParent=editor.value.mode==='add'?editor.value.parent:null
  const next=finishCollectionEdit(props.modelValue,editor.value,props.definition,resolvedField.value)
  emit('update:modelValue',next)
  for(const slot of sharedDraft.value.media)if(JSON.stringify(slot)!==JSON.stringify(props.shared.media.find(item=>item.key===slot.key)))emit('update:media',slot.key,slot)
  if(addedParent)collapsed.value=collapsed.value.filter(item=>item!==addedParent)
  editor.value=null;localErrors.value={};emit('validation','')
 }catch(cause){localErrors.value.confirm=cause instanceof Error?cause.message:'条目更新失败。'}
}
function clearConfirmError(){delete localErrors.value.confirm}
function replaceLocal(value:LocalizedSections){if(editor.value&&writable.value)editor.value.localized=value}
function childValidation(path:string,message:string){if(message)localErrors.value[path]=message;else delete localErrors.value[path]}
async function remove(row:CollectionEditorRow){
 if(!writable.value||structureError.value)return
 const message=resolvedField.value.tree?'将移除此节点及其全部下级，并同步各语言；保存页面草稿后生效。':'将从各语言中移除此条目，保存页面草稿后生效。'
 if(!await ask({title:`移除${row.itemLabel}？`,message,confirmLabel:'移除',cancelLabel:'取消'}))return
 try{emit('update:modelValue',removeCollectionRow(props.modelValue,props.locale,props.definition,resolvedField.value,row.key));error.value=''}
 catch(cause){error.value=cause instanceof Error?cause.message:'条目移除失败。'}
}
function move(row:CollectionEditorRow,direction:'up'|'down'){
 if(!writable.value||structureError.value)return
 try{emit('update:modelValue',moveCollectionRow(props.modelValue,props.locale,props.definition,resolvedField.value,row.key,direction));error.value=''}
 catch(cause){error.value=cause instanceof Error?cause.message:'排序失败。'}
}

 return {rows,pendingEditMessage,store,linkTargetsError,linkTargetsPending,resolvedField,collapsed,error,editor,createLevel,createParentKey,sharedDraft,rootRows,structureError,search,visibility,writable,tableRows,activeRow,parents,editorLabel,createLevelOptions,createParentOptions,createParentLabel,dirty,localMessage,hasChildren,toggle,canMove,cell,changeCell,open,beginCreate,selectCreateLevel,selectCreateParent,close,change,list,media,banner,confirm,clearConfirmError,replaceLocal,childValidation,remove,move}
}
