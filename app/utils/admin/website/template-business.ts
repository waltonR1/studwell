/** Server projection of policy template.modules; never infer modules from template keys. */
import type {WebsiteBusinessModule} from '#shared/types/admin/website'
export type TemplateBusinessModule = WebsiteBusinessModule

export function templateBusinessModules(template?: {name?: string; businessModules?: TemplateBusinessModule[]} | null): TemplateBusinessModule[] {
    return template?.businessModules ?? []
}

export function templateBusinessDisabled(template?: {name?: string; businessModules?: TemplateBusinessModule[]} | null): boolean {
    return templateBusinessModules(template).some(module => !module.enabled)
}

export function templateBusinessLabel(template: {name: string; businessModules?: TemplateBusinessModule[]}): string {
    const labels = templateBusinessModules(template).map(module => `${module.name}${module.enabled ? '' : '（业务已停用）'}`)
    return [template.name, ...labels].join(' · ')
}
