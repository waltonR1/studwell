// 模板配置窗口的文件读取、关闭确认和通知；请求及版本由模板 store 持有。
import {useAdminWebsiteTemplatesStore} from '~/stores/admin/website-templates'
import type {WebsiteMaintenanceController} from '~/types/admin/website-maintenance'
export function useTemplateConfiguration(confirmation:WebsiteMaintenanceController['confirmation'],toast:WebsiteMaintenanceController['toast']){
 const store=useAdminWebsiteTemplatesStore(),json=ref('')
 watch(()=>store.configuration,()=>{json.value=''})
 watch(()=>store.configuration?.definition?.key,key=>{
  const draft=store.configuration
  if(key&&draft&&!draft.id&&draft.definition){draft.definition.publicRendererId=key;draft.definition.previewRendererId=key;if(draft.definition.editor)draft.definition.editor.key=key}
 })
 async function importFile(event:Event){
  const target=event.target as HTMLInputElement,file=target.files?.[0]
  const draft=store.configuration
  if(!file)return
  if(file.size>1000000){store.configurationError='定义文件不能超过 1 MB。';target.value='';return}
  try{const text=await file.text();if(draft&&store.configuration===draft&&!draft.id){json.value=text;store.importDefinition(text)}}
  catch{store.configurationError='文件读取失败，请重新选择。'}
  finally{target.value=''}
 }
 async function close(){
  if(store.saving)return
  if((store.configurationDirty||json.value)&&!await confirmation.ask({title:'放弃模板配置修改？',message:'尚未保存的配置将被放弃。',confirmLabel:'放弃修改',cancelLabel:'继续编辑'}))return
  store.closeConfiguration()
 }
 async function save(){
  if(!store.configuration?.definition)return
  if(!await confirmation.ask({title:store.configuration.id?'保存新配置修订？':'登记区块模板？',message:store.configuration.id?'新装配使用新修订；已有区块和发布历史保持原样。':'登记后默认禁用，确认配置后可在列表启用。',confirmLabel:'确认保存',cancelLabel:'取消'}))return
  const result=await store.saveConfiguration()
  if(result)toast.show(result.message,result.status)
 }
 function exportDefinition(){
  const definition=store.configuration?.definition
  if(!definition)return
  const url=URL.createObjectURL(new Blob([JSON.stringify(definition,null,2)],{type:'application/json'})),link=document.createElement('a')
  link.href=url;link.download=definition.key+'.json';link.click()
  setTimeout(()=>URL.revokeObjectURL(url),0)
 }
 return {json,importFile,close,save,exportDefinition,importJson:()=>store.importDefinition(json.value)}
}
