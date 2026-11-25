// 读取当前有效的发布搜索快照，不生成搜索文档。
import {moduleEnabled} from './site-modules'
import {isNewsSearchPage} from './news-search-pages'
import {parseWebsiteRoutePattern} from '#shared/utils/website/route-pattern'
import {readPublishedSiteContext} from './site-languages'
import type {Database} from '../db/transaction'
import {publicNewsRepository} from '../repositories/public-news'
import {projectPublicSiteSettings} from './public-site-settings'
import {projectPublicWebsitePage} from './public-website-page'
import type {SearchSnapshot} from './search-documents'
import {websiteResourceRepository as resources} from '../repositories/website-resources'
import {publishedFieldDefinition,publishedPageSnapshotSchema} from '../policies/public-website-snapshot'
import type {SectionField} from '#shared/types/website/section-template'

// 所有语言、页面与新闻在同一已提交快照上读取。
export async function readSearchSnapshots(db:Database):Promise<SearchSnapshot[]> {
    return db.transaction(async tx => {
        const snapshots: SearchSnapshot[] = []
        // 同一发布版本的字段合同与语言无关，在本次事务内复用。
        const fieldsByRelease=new Map<string,Record<string,SectionField>>()
        const context=await readPublishedSiteContext(tx)
        for (const locale of context.languages.enabledLocales) {
            const settings = await projectPublicSiteSettings(tx,locale,false,context)
            const pages = []
            for (const key of Object.keys(settings.pages)) {
                const structure=settings.pages[key]!
                if (!parseWebsiteRoutePattern(structure.path)?.parameter&&structure.seo.indexable!==false) {
                    const page=await projectPublicWebsitePage(tx,key,locale,context)
                    let searchFields=fieldsByRelease.get(page.releaseId)
                    if(!searchFields){
                        const release=await resources.release(tx,BigInt(page.releaseId),BigInt(structure.resourceId))
                        if(!release)throw new Error('Missing published search snapshot')
                        const snapshot=publishedPageSnapshotSchema.parse(release.content)
                        searchFields=Object.fromEntries(snapshot.sections.filter(section=>section.visible).map(section=>[section.id,publishedFieldDefinition(section.definition)]))
                        fieldsByRelease.set(page.releaseId,searchFields)
                    }
                    pages.push({...page,searchFields})
                }
            }
            snapshots.push({locale,settings,pages})
        }
        if (await moduleEnabled(tx,'news')&&Object.values(snapshots[0]?.settings.pages ?? {}).some(page=>isNewsSearchPage(page))) {
            const news = (await publicNewsRepository.searchRows(tx)).map(({articleId,slug,content,categoryName}) =>
                ({id:String(articleId),slug,content,categoryName}))
            for (const snapshot of snapshots) snapshot.news = news
        }
        return snapshots
    }, {isolationLevel:'repeatable read'})
}
