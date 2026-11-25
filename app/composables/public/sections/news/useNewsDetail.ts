// 加载公开新闻详情并提供文章数据与请求状态。
import {recordPublicNewsView,usePublicNewsDetailApi} from '~/api/public/news'
import {resolveContentLocale} from '~/utils/public/runtime/locale'

export function useNewsDetail(targetKey:string) {
  const {locale}=useI18n()
  const slug=computed(()=>targetKey)
  const request=usePublicNewsDetailApi(slug,{
    query:computed(()=>({locale:resolveContentLocale(locale.value)})),
  })
  const ready=request.then(()=>{if(request.error.value)throw createError(request.error.value)})

  const loadedArticle=computed(()=>request.data.value?.success&&request.data.value.data.slug===slug.value
    ?request.data.value.data
    :null)
  const recorded=shallowRef<{id:string;viewCount:number|null}|null>(null)
  const article=computed(()=>{
    const item=loadedArticle.value
    return item&&recorded.value?.id===item.id?{...item,viewCount:recorded.value.viewCount}:item
  })

  onMounted(()=>{
    watch(()=>loadedArticle.value?.id,async(id,_,onCleanup)=>{
      recorded.value=null
      const item=loadedArticle.value
      if(!id||!item||item.viewCount===null)return
      let active=true
      onCleanup(()=>{active=false})
      try{
        const result=await recordPublicNewsView(item.slug)
        if(active)recorded.value={id,viewCount:result.viewCount}
      }catch{
        // 浏览量失败不阻断文章阅读。
      }
    },{immediate:true})
  })

  return {article,ready}
}
