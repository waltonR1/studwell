// 编辑组件使用共享的数据库表单描述类型。
import type {SectionContentDefinition} from '#shared/types/website/section-template'
import type {WebsiteSectionRecord} from '#shared/types/admin/website'
import type {SectionEditorProps} from '~/types/admin/website-section-editors'
import type {SectionFormDefinition} from '#shared/types/admin/section-form'
export type {FormFieldBase,ValueField,CollectionField,SlotField,BannerImagesField,FormField,SectionFormDefinition} from '#shared/types/admin/section-form'
export interface SectionFormProps extends SectionEditorProps {config:SectionFormDefinition;definition:SectionContentDefinition;shared:WebsiteSectionRecord['shared']}
export type ListAction='add'|'remove'|'up'|'down'
