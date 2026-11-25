import type {WebsiteSectionRecord} from '#shared/types/admin/website'
import type {SiteLocale} from '#shared/schemas/admin/site-settings'

export type LocalizedSections=WebsiteSectionRecord['localized']
export interface SectionEditorProps {modelValue:LocalizedSections;locale:SiteLocale;disabled?:boolean;readonly?:boolean;sectionId:string;mediaKey?:string|null;bannerName?:string;confirmRemove?:(message?:string)=>Promise<boolean>}

