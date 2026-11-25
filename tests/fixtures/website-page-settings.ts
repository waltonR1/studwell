import {createLocalized} from '../../shared/utils/localized'
import type {WebsitePageSettings} from '../../shared/schemas/website/page-settings'
import {emptyPageSettings} from '../../shared/utils/website/page-layouts'

export function fixturePageSettings(title='Fixture page'):WebsitePageSettings{
 return {...emptyPageSettings(),displayName:createLocalized(()=>title)}
}
