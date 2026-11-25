import type {AdminApiClient} from '~/types/admin/api'
import type {WebsiteTemplateCatalogRecord} from '#shared/types/admin/website'
import type {z} from 'zod'
import type {websiteTemplateDeleteSchema,websiteTemplateUpdateSchema} from '#shared/schemas/admin/website-pages'
import type {templateRegistrationSchema,templateRevisionUpdateSchema} from '#shared/schemas/admin/template-maintenance'
export function createWebsiteTemplatesApi(api:AdminApiClient){return {
 read:()=>api.read<WebsiteTemplateCatalogRecord[]>('website-templates'),
 register:(body:z.infer<typeof templateRegistrationSchema>)=>api.mutate<WebsiteTemplateCatalogRecord[]>('website-templates','POST',body),
 revise:(id:string,body:z.infer<typeof templateRevisionUpdateSchema>)=>api.mutate<WebsiteTemplateCatalogRecord[]>(`website-templates/${id}/configuration`,'PUT',body),
 update:(id:string,body:z.infer<typeof websiteTemplateUpdateSchema>)=>api.mutate<WebsiteTemplateCatalogRecord[]>(`website-templates/${id}`,'PUT',body),
 remove:(id:string,body:z.infer<typeof websiteTemplateDeleteSchema>)=>api.mutate<WebsiteTemplateCatalogRecord[]>(`website-templates/${id}`,'DELETE',body),
}}
