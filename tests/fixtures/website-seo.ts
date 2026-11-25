import type { DatabaseExecutor } from '../../server/db/transaction';
import { websitePageSeo, websitePublishedSeo } from '../../server/db/schema';
import { siteLocales } from '../../shared/schemas/admin/site-settings';
import type { WebsiteSeoEntry } from '../../shared/types/website/site-config';
export function seoEntries(resourceId: string, overrides: Partial<Omit<WebsiteSeoEntry, 'resourceId' | 'locale'>> = {}): WebsiteSeoEntry[] {
    return siteLocales.map(locale => ({ resourceId, locale, title: 'Fixture title', description: 'Fixture description', indexable: true, ogTitle: '', ogDescription: '', ogMediaId: null, ...overrides }));
}
async function setupSeo(db: DatabaseExecutor, table: typeof websitePageSeo | typeof websitePublishedSeo, resourceId: string, overrides: Parameters<typeof seoEntries>[1]) {
    const entries = seoEntries(resourceId, overrides);
    for (const entry of entries) {
        const value = { ...entry, resourceId: BigInt(entry.resourceId), ogMediaId: entry.ogMediaId ? BigInt(entry.ogMediaId) : null };
        await db.insert(table).values(value).onDuplicateKeyUpdate({ set: value });
    }
    return entries;
}
export const setupDraftSeo = (db: DatabaseExecutor, resourceId: string, overrides: Parameters<typeof seoEntries>[1] = {}) => setupSeo(db, websitePageSeo, resourceId, overrides);
export const setupPublishedSeo = (db: DatabaseExecutor, resourceId: string, overrides: Parameters<typeof seoEntries>[1] = {}) => setupSeo(db, websitePublishedSeo, resourceId, overrides);
// Manual route fixtures must carry the same immutable configuration as their public projection.
export async function setupPublishedSiteConfig(db: DatabaseExecutor, actor: bigint) {
    const { readPublishedRoutes } = await import('../../server/repositories/website-route-tree');
    const { readSeo, lockSiteConfig, appendConfigRelease, bumpSiteConfig } = await import('../../server/repositories/website-site-config');
    const state = await lockSiteConfig(db);
    const routes = (await readPublishedRoutes(db)).map(row => ({ ...row, resourceId: String(row.resourceId), routeNodeId: row.routeNodeId === null ? null : String(row.routeNodeId) }));
    const {lockLanguageConfig,appendLanguageRelease,saveLanguageConfig}=await import('../../server/repositories/site-languages')
    const languageState=await lockLanguageConfig(db)
    const languageRelease=await appendLanguageRelease(db,actor,languageState.version,languageState.languages,null)
    await saveLanguageConfig(db,languageState.version,{publishedReleaseId:languageRelease.id})
    const release = await appendConfigRelease(db, actor, state.version, { routes, seo: await readSeo(db) });
    if (!await bumpSiteConfig(db, state.version, release.id))
        throw new Error('FIXTURE_CONFIG_CONFLICT');
    return release;
}
