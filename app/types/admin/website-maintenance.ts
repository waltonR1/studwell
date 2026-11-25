import type {ComputedRef,Ref} from 'vue'
import type {SiteRelease} from '#shared/types/admin/site-settings'
import type {AdminToastNotification,AdminConfirmation} from './interaction'
import type {SiteLocale,SiteSection} from '#shared/schemas/admin/site-settings'
import type {SiteTarget} from '#shared/types/admin/site-settings'
import type {SiteLanguages} from '#shared/config/site-languages'
import type {SiteLanguageState} from '#shared/types/admin/site-languages'

// 公共框架只消费生命周期和公共操作，不解释业务字段与历史详情 props。
export type WebsiteMaintenanceController=Omit<WebsiteMaintenanceAdapter<unknown,unknown>,'contentProps'|'detailProps'>

// SFC 宏需要可静态解析的 props 属性，不能从组合式函数返回值反推整个对象。
export interface LanguageMaintenanceContent {
 record:Ref<SiteLanguageState|null>
 form:Ref<SiteLanguages>
 busy:ComputedRef<boolean>
}

export interface PageContentActions {
 deleteOpen:Ref<boolean>
 toast:{show:(message:string,tone?:AdminToastNotification['tone'])=>void}
 openDeletion:()=>void
 permanentlyRemove:(code:string)=>Promise<void>
 remove:(id:string)=>Promise<void>
 closeAssemblyEditor:()=>Promise<void>
}
export interface SiteContentActions {
 closeEditor:()=>Promise<void>
 confirmLink:()=>void
 remove:(list:unknown[],index:number)=>Promise<void>
}
export interface PageMaintenanceContent {locale:SiteLocale;actions:PageContentActions}
export interface SiteMaintenanceContent {page:SiteSection;locale:SiteLocale;actions:SiteContentActions}
export interface PageMaintenanceDetail {locale:SiteLocale}
export interface SiteMaintenanceDetail {section:SiteSection;targets:SiteTarget[]}

export interface WebsiteMaintenanceAdapter<Content=PageMaintenanceContent|SiteMaintenanceContent,Detail=PageMaintenanceDetail|SiteMaintenanceDetail> {
 key:string
 view:ComputedRef<{
  title:string;description:string;className:string;ready:boolean;loading:boolean;loadError:string;saveError:string;
  dirty:boolean;busy:boolean;saving:boolean;canEdit:boolean;canPublish:boolean;historyEnabled:boolean;saveEnabled:boolean;publishEnabled:boolean;
  status:string|undefined;showLocale:boolean;deleted:boolean;showWithdraw:boolean;withdrawDisabled:boolean;
  releases:Pick<SiteRelease,'id'|'createdAt'|'restoredFrom'|'createdBy'|'createdByUsername'|'createdByStatus'>[];currentReleaseId:string|null
 }>
 contentProps:ComputedRef<Content>
 detailProps:ComputedRef<Detail>
 toast:{notification:Ref<AdminToastNotification|null>;show:(message:string,tone?:AdminToastNotification['tone'])=>void;dismiss:()=>void}
 confirmation:{state:Ref<AdminConfirmation|null>;ask:(options:AdminConfirmation)=>Promise<boolean>;settle:(accepted:boolean)=>void}
 historyOpen:Ref<boolean>
 enter:()=>Promise<void>;leave:()=>void;load:()=>Promise<void>;save?:()=>Promise<void>;publish:(id?:string)=>Promise<void>;cleanupRelease?:(id:string)=>Promise<void>;withdraw?:()=>Promise<void>;resetUi:()=>void
}
