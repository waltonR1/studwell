import {emptyLocalizedText} from '#shared/utils/localized'
import {computed,ref,watch} from 'vue'
import {defineStore} from 'pinia'
import {createNewsApi} from '~/api/admin/news'
import {createPublicationHistoryApi} from '~/api/admin/publication-history'
import {useAdminRequestStore} from './request'
import {useAdminSessionStore} from './session'
import {emptyNewsContent,newsCodeSchema,type NewsCategoryInput} from '#shared/schemas/admin/news'
import type {NewsArticle,NewsCategory,NewsRelease,NewsOperations} from '#shared/types/admin/news'
import type {AdminOperationResult} from '~/types/admin/action-result'
import {getAdminRequestFailure} from '~/utils/admin/request/errors'
const copy=<T>(v:T):T=>JSON.parse(JSON.stringify(v))
type CategoryDraft=NewsCategoryInput & {id:string|null;version?:number}
export const useAdminNewsStore=defineStore('admin-news',()=>{
 const request=useAdminRequestStore(),session=useAdminSessionStore(),api=createNewsApi(request)
 const items=ref<NewsArticle[]>([]),categories=ref<NewsCategory[]>([]),operations=ref<NewsOperations|null>(null),total=ref(0)
 const query=ref({page:1,pageSize:20,search:'',status:'all',categoryId:''})
 const pending=ref(false),busy=ref(false),error=ref(''),warning=ref(''),saveError=ref(''),draft=ref<NewsArticle|null>(null),categoryDraft=ref<(NewsCategoryInput & {id:string|null;version?:number})|null>(null),release=ref<NewsRelease|null>(null)
 const categoryChanges=ref<{key:string;value:CategoryDraft}[]>([])
 const categoryKey=ref('')
 let nextCategoryKey=0
 const original=ref(''),dirty=computed(()=>!!(draft.value||categoryDraft.value)&&JSON.stringify(draft.value||categoryDraft.value)!==original.value)
 const categoryDirty=computed(()=>categoryChanges.value.length>0)
 const categoryEntries=computed(()=>{
  const existing=categories.value.map(c=>({key:c.id,value:categoryChanges.value.find(change=>change.key===c.id)?.value??c}))
  return [...existing,...categoryChanges.value.filter(change=>!change.value.id||!categories.value.some(c=>c.id===change.key))]
 })
 let epoch=0,sequence=0,editSequence=0,includeOperations=false
 function leave(){epoch++;sequence++;editSequence++;items.value=[];categories.value=[];categoryChanges.value=[];categoryKey.value='';operations.value=null;includeOperations=false;draft.value=categoryDraft.value=release.value=null;error.value=warning.value=saveError.value='';pending.value=busy.value=false}
 async function load(withOperations=includeOperations):Promise<'ok'|'failed'|'stale'>{
  includeOperations=withOperations
  const token=++sequence,g=session.generation,e=epoch
  pending.value=true
  error.value=warning.value=''
  try{
   const [list,cats,settings]=await Promise.all([
    api.list({...query.value,categoryId:query.value.categoryId||undefined}),
    api.categories(),
    includeOperations?api.operations():null,
   ])
   if(token!==sequence||g!==session.generation||e!==epoch)return 'stale'
   items.value=list.items
   total.value=list.total
   categories.value=cats
   operations.value=settings
   return 'ok'
  }catch(err){
   if(token===sequence&&e===epoch&&g===session.generation){
    error.value=request.message(err)
    return 'failed'
   }
   return 'stale'
  }finally{
   if(token===sequence&&e===epoch&&g===session.generation)pending.value=false
  }
 }
 async function edit(id?:string){if(busy.value)return;const token=++editSequence,g=session.generation,e=epoch;saveError.value='';if(!id){const category=categories.value.find(c=>c.enabled);if(!category){saveError.value='请先创建并启用新闻分类。';return}draft.value={id:'',slug:'',viewCount:0,content:emptyNewsContent(category.id),version:1,stateVersion:1,publishedReleaseId:null,status:'unpublished',changed:true,updatedAt:'',releases:[]};original.value=JSON.stringify(draft.value);return}busy.value=true;try{const next=await api.detail(id);if(e===epoch&&g===session.generation&&token===editSequence){draft.value=next;original.value=JSON.stringify(next)}}catch(err){if(e===epoch&&g===session.generation)saveError.value=request.message(err)}finally{if(e===epoch&&g===session.generation)busy.value=false}}
 function editCategory(key?:string){
  if(busy.value)return
  const entry=key?categoryEntries.value.find(item=>item.key===key):undefined
  if(key&&!entry)return
  categoryKey.value=entry?.key??'new_'+(++nextCategoryKey)
  categoryDraft.value=entry?copy(entry.value):{id:null,code:'',name:emptyLocalizedText(),sortOrder:Math.min(100000,categoryEntries.value.length*100),enabled:true}
  original.value=JSON.stringify(categoryDraft.value);saveError.value=''
 }
 function confirmCategory(){
  const value=categoryDraft.value
  if(!value||busy.value||!session.can('content.news.categories.update'))return
  const key=categoryKey.value
  if(!newsCodeSchema.safeParse(value.code).success){saveError.value='分类编码须以小写字母开头，只能包含小写字母、数字、下划线和短横线。';return}
  if(categoryEntries.value.some(entry=>entry.key!==key&&entry.value.code===value.code)){saveError.value='分类编码已存在。';return}
  stageCategory(key,value)
  close()
 }
 function stageCategory(key:string,value:CategoryDraft){
  const saved=categories.value.find(c=>c.id===key)
  categoryChanges.value=categoryChanges.value.filter(entry=>entry.key!==key)
  if(!saved||JSON.stringify(saved)!==JSON.stringify(value))categoryChanges.value.push({key,value:copy(value)})
 }
 function stageCategoryEnabled(key:string,enabled:boolean){
  const entry=categoryEntries.value.find(item=>item.key===key)
  if(entry&&!busy.value&&session.can('content.news.categories.update'))stageCategory(key,{...entry.value,enabled})
 }
 function discardNewCategory(key:string){
  if(!busy.value)categoryChanges.value=categoryChanges.value.filter(entry=>entry.key!==key||entry.value.id!==null)
 }
 function discardCategoryChanges(){categoryChanges.value=[]}
 function close(){if(busy.value)return;editSequence++;draft.value=categoryDraft.value=release.value=null;saveError.value=''}
 async function mutate(
  work:()=>Promise<unknown>,
  message:string,
  errorDelivery:'form'|'toast'='form',
 ):Promise<AdminOperationResult|null>{
  if(busy.value)return null
  const g=session.generation,e=epoch
  busy.value=true
  warning.value=saveError.value=''
  try{
   await work()
   if(e!==epoch||g!==session.generation)return null
   draft.value=categoryDraft.value=null
   const loaded=await load()
   if(e!==epoch||g!==session.generation||loaded==='stale')return null
   if(loaded==='failed'){
    const failure=`操作已完成，但列表刷新失败：${error.value}`
    error.value=''
    warning.value='列表待刷新'
    return {message:failure,status:'warning'}
   }
   return {message,status:'success'}
  }catch(err){
   if(e===epoch&&g===session.generation){
    const generic=request.operationMessage(err),failure=getAdminRequestFailure(err)
    const message=generic?(failure?.fields?.join('；')||generic):''
    if(errorDelivery==='toast'||failure?.code!=='INVALID_INPUT')return message?{message,status:'error'}:null
    saveError.value=message
   }
   return null
  }finally{
   if(e===epoch&&g===session.generation)busy.value=false
  }
 }
 async function save(){const a=draft.value;if(!a||!session.can('content.news.update'))return null;return mutate(()=>api.save(a.id||null,{slug:a.slug,content:copy(a.content),...(a.id?{version:a.version}:{})}),'新闻草稿已保存。')}
 async function saveCategories(){
  if(!categoryDirty.value||categoryDraft.value||busy.value||pending.value||!session.can('content.news.categories.update'))return null
  const g=session.generation,e=epoch
  return mutate(async()=>{
   for(const entry of categoryChanges.value){
    const {id,...value}=copy(entry.value)
    const saved=await api.categorySave(id,value)
    if(e!==epoch||g!==session.generation)return
    categories.value=[...categories.value.filter(c=>c.id!==saved.id),saved].sort((a,b)=>a.sortOrder-b.sortOrder||a.id.localeCompare(b.id))
    categoryChanges.value=categoryChanges.value.filter(change=>change.key!==entry.key)
   }
  },'新闻分类已保存。')
 }
 async function categoryDelete(c:NewsCategory){if(!session.can('content.news.categories.update'))return null;return mutate(()=>api.categoryDelete(c.id,c.version),'新闻分类已删除。','toast')}
 async function setCategoryEnabled(c:NewsCategory,enabled:boolean){if(busy.value||pending.value||draft.value||categoryDraft.value||!session.can('content.news.categories.update')||c.enabled===enabled)return null;const {id,...value}=copy(c);return mutate(()=>api.categorySave(id,{...value,enabled}),enabled?'新闻分类已启用。':'新闻分类已停用。','toast')}
 async function moveCategory(c:NewsCategory,direction:'up'|'down'){if(busy.value||pending.value||draft.value||categoryDraft.value||!session.can('content.news.categories.update'))return null;const index=categories.value.findIndex(item=>item.id===c.id),neighbor=categories.value[index+(direction==='up'?-1:1)];if(index<0||!neighbor)return null;return mutate(()=>api.categoryMove(c,neighbor,direction),'新闻分类顺序已调整。','toast')}
 async function action(a:NewsArticle,kind:'publish'|'restore'|'withdraw'|'delete',releaseId?:string){if(!session.can(kind==='delete'?'content.news.delete':'content.news.publish'))return null;return mutate(()=>api.action(a,kind,releaseId),({publish:'新闻已发布，搜索索引待更新。',restore:'已恢复历史版本，工作草稿保留。搜索索引待更新。',withdraw:'新闻已下线，搜索索引待更新。',delete:'新闻草稿已删除。'})[kind],'toast')}
 async function cleanupRelease(a:NewsArticle,releaseId:string):Promise<AdminOperationResult|null>{
  if(busy.value||pending.value||!session.can('content.news.publish'))return null
  const g=session.generation,e=epoch
  busy.value=true
  try{
   await createPublicationHistoryApi(request).cleanup({kind:'news',articleId:a.id,releaseId,version:a.version,stateVersion:a.stateVersion,publishedReleaseId:a.publishedReleaseId})
   const next=await api.detail(a.id)
   if(e!==epoch||g!==session.generation)return null
   const index=items.value.findIndex(item=>item.id===a.id)
   if(index>=0)items.value[index]=next
   // 编辑中的正文保留，仅同步发布状态，避免下一次操作沿用旧锁版本。
   if(draft.value?.id===a.id){
    draft.value.stateVersion=next.stateVersion;draft.value.releases=next.releases
    const baseline=JSON.parse(original.value) as NewsArticle
    baseline.stateVersion=next.stateVersion;baseline.releases=next.releases
    original.value=JSON.stringify(baseline)
   }
   return {status:'success',message:'新闻历史发布已清理，图片文件保留在媒体库。'}
  }catch(err){
   if(e!==epoch||g!==session.generation)return null
   const message=request.operationMessage(err),failure=getAdminRequestFailure(err)
   return message?{status:'error',message:failure?.fields?.join('；')||message}:null
  }finally{if(e===epoch&&g===session.generation)busy.value=false}
 }
 async function viewRelease(a:NewsArticle,id:string):Promise<AdminOperationResult|null>{
  if(busy.value)return null
  const g=session.generation,e=epoch
  busy.value=true
  try{
   const next=await api.release(a.id,id)
   if(e===epoch&&g===session.generation)release.value=next
   return null
  }catch(err){
   if(e!==epoch||g!==session.generation)return null
   const failure=request.operationMessage(err)
   return failure?{message:failure,status:'error'}:null
  }finally{
   if(e===epoch&&g===session.generation)busy.value=false
  }
 }
 async function saveOperations(viewCountEnabled:boolean){const settings=operations.value;if(!settings||!session.can('content.news.operations.update'))return null;return mutate(()=>api.saveOperations({version:settings.version,viewCountEnabled}),'浏览量设置已保存。','toast')}
 watch(()=>session.generation,leave)
 return {items,categories,categoryEntries,categoryDirty,operations,total,query,pending,busy,error,warning,saveError,draft,categoryDraft,release,dirty,load,leave,edit,editCategory,confirmCategory,stageCategoryEnabled,discardNewCategory,discardCategoryChanges,close,save,saveCategories,categoryDelete,setCategoryEnabled,moveCategory,action,cleanupRelease,viewRelease,saveOperations}
})
