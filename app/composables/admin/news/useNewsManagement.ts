// 新闻管理交互编排：查询同步、确认通知和窗口生命周期；实体草稿与请求仍归 news store。
import {useReleaseCleanup} from '~/composables/admin/website/useReleaseCleanup'
import {adminContentLocale} from '#shared/config/site-languages'
import {storeToRefs} from 'pinia'
import {useAdminListQuery} from '~/composables/admin/list/useAdminListQuery'
import {useAdminPreferencesStore} from '~/stores/admin/preferences'
import {useAdminNewsStore} from '~/stores/admin/news'
import {useAdminSessionStore} from '~/stores/admin/session'
import {useAdminUnsavedGuard} from '~/composables/admin/forms/useAdminUnsavedGuard'
import {useAdminRefresh,useAdminBusy} from '~/composables/admin/navigation/useAdminRefresh'
import {useAdminToast} from '~/composables/admin/interaction/useAdminToast'
import {useAdminActionConfirm} from '~/composables/admin/interaction/useAdminActionConfirm'
import type {SiteLocale} from '#shared/schemas/admin/site-settings'
import type {NewsArticle} from '#shared/types/admin/news'
import type {AdminOperationResult} from '~/types/admin/action-result'
export function useNewsManagement(props:{readonly mode:'articles'|'categories'}){
const title={articles:'文章管理',categories:'新闻分类'}[props.mode]

const store=useAdminNewsStore(),session=useAdminSessionStore(),toast=useAdminToast(),confirmation=useAdminActionConfirm()
const canEditArticle=computed(()=>session.can('content.news.update'))
const canEditCategory=computed(()=>session.can('content.news.categories.update'))
const {items,categories,categoryEntries,categoryDirty,total,query,pending,busy,error,warning,saveError,draft,categoryDraft,release,dirty,operations}=storeToRefs(store)
const locale=ref<SiteLocale>(adminContentLocale),preview=ref(false),history=ref<NewsArticle|null>(null)
const preferences=useAdminPreferencesStore(),actorId=session.session?.user?.id??'anonymous'
const list=useAdminListQuery({path:'/admin/news/'+props.mode,filterKey:'status',filterValues:['published','offline','unpublished'],defaultPageSize:preferences.pageSize(actorId)})
const categoryFilter=ref(query.value.categoryId),appliedCategory=ref(query.value.categoryId)
const categorySearch=ref(''),categoryStatus=ref(''),appliedCategorySearch=ref(''),appliedCategoryStatus=ref('')
const categoryRows=computed(()=>categoryEntries.value.filter(({value:c})=>(!appliedCategorySearch.value||[c.code,...Object.values(c.name)].join(' ').toLowerCase().includes(appliedCategorySearch.value.toLowerCase()))&&(!appliedCategoryStatus.value||c.enabled===(appliedCategoryStatus.value==='visible'))).map(({key,value:c})=>({id:key,name:c.name[locale.value]||'未填写',visible:c.enabled,code:c.code})))
function queryCategories(){appliedCategorySearch.value=categorySearch.value.trim();appliedCategoryStatus.value=categoryStatus.value}
function canMoveCategory(id:string,direction:'up'|'down'){const index=categories.value.findIndex(c=>c.id===id);return !categoryDirty.value&&index>=0&&(direction==='up'?index>0:index<categories.value.length-1)}
let alive=true,initialized=false,submitting=false
async function sync(){
 if(!alive||!initialized)return
 if(props.mode!=='categories')Object.assign(query.value,{...list.apiQuery.value,status:list.applied.value.filter||'all',categoryId:appliedCategory.value,pageSize:list.apiQuery.value.pageSize??preferences.pageSize(actorId)})
 await store.load(props.mode==='articles')
}
watch([list.apiQuery,appliedCategory],()=>{if(!submitting)void sync()})
const guard=useAdminUnsavedGuard(()=>dirty.value||categoryDirty.value,'新闻内容尚未保存。')
useAdminBusy(()=>busy.value)
onBeforeRouteLeave(()=>!busy.value)
onBeforeUnmount(()=>{alive=false;initialized=false;store.leave()})
watch(()=>session.generation,()=>{preview.value=false;history.value=null;toast.dismiss()})
useAdminRefresh(async()=>{store.close();store.discardCategoryChanges();await store.load();if(error.value)throw new Error(error.value)},async()=>!busy.value&&await guard.guard())
onMounted(async()=>{
 try{await preferences.load(actorId)}catch(cause){if(alive)showError(cause as Error);return}
 if(!alive)return
 if(list.applied.value.pageSize===undefined)list.draft.pageSize=String(preferences.pageSize(actorId))
 initialized=true
 await sync()
})
async function notify(p:Promise<AdminOperationResult|null>){const result=await p;if(result)toast.show(result.message,result.status)}
async function close(){
 if(busy.value)return
 if(categoryDraft.value){
  if(dirty.value&&!await confirmation.ask({title:'放弃本次修改？',message:'此窗口中的修改尚未确认。',confirmLabel:'放弃修改',cancelLabel:'继续编辑'}))return
 }else if(!await guard.guard())return
 store.close();preview.value=false
}
async function action(a:NewsArticle,kind:'publish'|'restore'|'withdraw'|'delete',id?:string,reopen=false){
 const name=reopen?'上线':({publish:'发布',restore:'恢复',withdraw:'下线',delete:'永久删除'})[kind]
 const message=reopen?'上线最近一次发布的版本，未发布草稿不会公开。':kind==='restore'?'恢复历史发布版本，工作草稿保持不变。':name+'：'+(a.content.localized[adminContentLocale]?.title||a.slug)
 if(await confirmation.ask({title:name+'新闻？',message,confirmLabel:name,cancelLabel:'取消'})){
  const result=await store.action(a,kind,id)
  if(result)toast.show(result.message,result.status)
  if(result&&result.status!=='error'){history.value=null;store.release=null}
 }
}
const cleanupRelease=useReleaseCleanup(confirmation,toast,async id=>{
 const article=history.value
 if(!article)return null
 const result=await store.cleanupRelease(article,id)
 if(result?.status==='success')history.value=store.items.find(item=>item.id===article.id)??null
 return result
})
async function setCategoryEnabled(id:string,enabled:boolean){
 if(categoryDirty.value){store.stageCategoryEnabled(id,enabled);return}
 const c=categories.value.find(item=>item.id===id)
 if(!c)return
 if(!enabled&&!await confirmation.ask({title:'停用新闻分类？',message:'此分类下的文章会停止在官网展示，文章发布记录保留。',confirmLabel:'停用分类',cancelLabel:'取消'}))return
 await notify(store.setCategoryEnabled(c,enabled))
}
async function deleteCategory(id:string){
 const c=categories.value.find(item=>item.id===id)
 if(!c){
  if(await confirmation.ask({title:'移除新增分类？',message:'此分类尚未保存。',confirmLabel:'移除',cancelLabel:'取消'}))store.discardNewCategory(id)
  return
 }
 if(categoryDirty.value){toast.show('请先保存分类修改，再删除已保存的分类。','warning');return}
 if(await confirmation.ask({title:'删除新闻分类？',message:'已有文章或历史引用的分类不能删除。',confirmLabel:'删除',cancelLabel:'取消'}))await notify(store.categoryDelete(c))
}
function moveCategory(id:string,direction:'up'|'down'){const c=categories.value.find(item=>item.id===id);if(c&&canMoveCategory(id,direction))void notify(store.moveCategory(c,direction))}
async function search(){
 if(busy.value||pending.value)return
 submitting=true
 try{appliedCategory.value=categoryFilter.value;await list.submitSearch();await nextTick()}finally{submitting=false}
 await sync()
}

return {categoryEntries,appliedCategorySearch,appliedCategoryStatus,title,store,session,toast,confirmation,canEditArticle,canEditCategory,items,categories,categoryDirty,total,query,pending,busy,error,warning,saveError,draft,categoryDraft,release,dirty,operations,locale,preview,history,list,categoryFilter,categorySearch,categoryStatus,categoryRows,queryCategories,canMoveCategory,notify,close,action,cleanupRelease,setCategoryEnabled,deleteCategory,moveCategory,search}
}
