// Build publication snapshots from the fixture catalog, matching the production contract.
import {websiteTemplateCatalog} from './reference/template-catalog'
import {validatePagePublication} from '../../server/policies/website-pages'
import type {SiteLocale} from '../../shared/schemas/admin/site-settings'

export function validateFixturePublication(
    pageKey: string,
    draft: {settings: unknown; sections: Array<{templateKey: string}>},
    locales?: readonly SiteLocale[],
) {
    const sections = draft.sections.map((section, index) => {
        const definition = websiteTemplateCatalog.find(template => template.key === section.templateKey)!
        return {
            id: String(index + 1),
            shared: {media: []},
            ...section,
            renderer: definition.key,
            videoPath: definition.banner?.videoPath ?? null,
            name: definition.name,
            allowedPages: definition.allowedPages,
            definition: definition.fields,
            mediaSlots: definition.mediaSlots,
        }
    })
    return validatePagePublication(pageKey, {settings: draft.settings, sections}, locales).then(() => undefined)
}
