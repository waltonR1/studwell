// 统一历史清理的确认文案和通知；请求、版本及草稿由各业务 store 持有。
import type {AdminOperationResult} from '~/types/admin/action-result'
import type {WebsiteMaintenanceController} from '~/types/admin/website-maintenance'
export function useReleaseCleanup(confirmation:WebsiteMaintenanceController['confirmation'],toast:WebsiteMaintenanceController['toast'],run:(id:string)=>Promise<AdminOperationResult|null>){
 return async (id:string)=>{
  if(!await confirmation.ask({title:'永久清理此历史发布？',message:'清理后无法查看或恢复此版本；其他版本的恢复来源记录会解除，内容仍保留。此版本的图片引用会释放，图片文件不会自动删除。',confirmLabel:'永久清理',cancelLabel:'取消'}))return
  toast.dismiss()
  const result=await run(id)
  if(result)toast.show(result.message,result.status)
 }
}
