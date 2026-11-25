import {defineAsyncComponent,type Component} from 'vue'
import {resolveSectionRenderer} from '~/utils/public/runtime/sectionRenderer.ts'

const publicPrefix='app/components/public/'
const adminPrefix='app/components/admin/preview/templates/'
const adminPreviews=import.meta.glob<{default:Component}>('../../../components/admin/preview/templates/**/*.vue')

export function resolveTemplatePreview(path:string){
 if(path.startsWith(publicPrefix))return resolveSectionRenderer(path)
 if(!path.startsWith(adminPrefix))throw new Error('Invalid template preview path: '+path)
 const load=adminPreviews['../../../components/admin/preview/templates/'+path.slice(adminPrefix.length)]
 if(!load)throw new Error('Unregistered template preview: '+path)
 return defineAsyncComponent(async()=>(await load()).default)
}
