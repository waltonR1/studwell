import {websitePageSettingsSchema} from '#shared/schemas/website/page-settings'
import {sectionContentSchema} from '#shared/schemas/website/section-content'
// Test-only fixture builder for website publication and editing regressions.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, basename, extname, relative, isAbsolute, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Database } from '../../server/db/transaction';
import type { MediaStorage } from '../../server/core/media-storage';
import { websiteResources, websiteDrafts, websiteTemplates, websiteTemplateRevisions, websiteSections, mediaAssets, adminUsers } from '../../server/db/schema';
import { withEntityIds } from '../../server/db/allocate-entity-id';
import { websiteTemplateCatalog } from './reference/template-catalog';
import { templateDefinition } from './reference/template-catalog';
;
import { siteLocales } from '#shared/schemas/admin/site-settings';
import { prepareImportedMedia } from './import-media';
import { createMediaService } from '../../server/services/media';
import { mediaRepository } from '../../server/repositories/media';
import { snapshotMedia } from '../../server/policies/website-media';
import content from './website-content.json';
export async function importWebsiteContent(db: Database, storage: MediaStorage, publicRoot: string, reportDirectory: string) {
    const [root] = await db.select().from(adminUsers).where(eq(adminUsers.isRoot, true));
    if (!root || root.deletedAt || !root.enabled)
        throw new Error('WEBSITE_IMPORT_ROOT_REQUIRED');
    const report = { createdAt: new Date().toISOString(), pages: [] as Array<{
            key: string;
            status: string;
            sections: number;
        }>, media: [] as Array<{
            source: string;
            id: string;
            storageKey: string;
            digest: string;
            sourceDigest: string;
            normalized: boolean;
            reused: boolean;
        }>, failures: [] as string[] };
    const id = randomUUID(), meta = { ip: 'local', userAgent: 'website-content-import', requestId: id }, media = createMediaService(db, storage);
    const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex'), existing = new Map<string, typeof mediaAssets.$inferSelect>();
    for (const asset of await db.select().from(mediaAssets)) {
        try {
            existing.set(hash(await storage.read(asset.storageKey)), asset);
        }
        catch { /* Missing files are not reused; report separately through source validation. */ }
    }
    const mediaMap = new Map<string, string>(), created: Array<{
        id: string;
        version: number;
    }> = [];
    const sourceSet = new Set(content.pages.flatMap(p => p.sections.flatMap(s => [...s.media.map(m => m.source), ...s.contentMedia])));
    const sources = [...sourceSet].sort();
    try {
        for (const source of sources) {
            const path = resolve(publicRoot, '.' + source), base = resolve(publicRoot);
            const location = relative(base, path);
            if (!location || location === '..' || location.startsWith('..' + sep) || isAbsolute(location))
                throw new Error('WEBSITE_SOURCE_OUTSIDE_PUBLIC');
            const sourceBytes = await readFile(path), suffix = extname(source).toLowerCase(), mime = suffix === '.jpg' || suffix === '.jpeg' ? 'image/jpeg' : suffix === '.mp4' ? 'video/mp4' : `image/${suffix.slice(1)}`, prepared = prepareImportedMedia(sourceBytes, basename(source), mime), bytes = prepared.bytes, digest = hash(bytes), previous = existing.get(digest);
            let asset = previous;
            if (!asset) {
                const result = await media.upload(root.id, { name: basename(source).slice(0, 100), remark: `官网内容导入 ${source}` }, { bytes, filename: basename(source), mime }, meta);
                created.push({ id: result.id, version: result.version });
                asset = (await mediaRepository.find(db, BigInt(result.id)))!;
                existing.set(digest, asset);
            }
            if (!asset.storageKey.startsWith('uploads/'))
                throw new Error('WEBSITE_MEDIA_NOT_IN_UPLOADS');
            if (hash(await storage.read(asset.storageKey)) !== digest)
                throw new Error('WEBSITE_MEDIA_COPY_MISMATCH');
            mediaMap.set(source, String(asset.id));
            report.media.push({ source, id: String(asset.id), storageKey: asset.storageKey, digest, sourceDigest: hash(sourceBytes), normalized: prepared.normalized, reused: !!previous });
        }
        await db.transaction(async (tx) => {
            const registered = await tx.select().from(websiteTemplates);
            for (const def of websiteTemplateCatalog) {
                if (registered.some(t => t.key === def.key))
                    continue;
                const t = await withEntityIds(tx, 'website_templates', { key: def.key, name: def.name, description: '现有官网区块。', enabledForNew: true, createdBy: root.id, updatedBy: root.id });
                await tx.insert(websiteTemplates).values(t);
            }
            const templates = await tx.select().from(websiteTemplates);
            const revisions = await tx.select().from(websiteTemplateRevisions);
            for (const template of templates) if (!revisions.some(row=>row.templateId===template.id)) await tx.insert(websiteTemplateRevisions).values({templateId:template.id,version:1,definition:templateDefinition(template.key)!});
            for (const page of content.pages) {
                if ((await tx.select().from(websiteResources).where(eq(websiteResources.key, `page.${page.key}`))).length) {
                    report.pages.push({ key: page.key, status: 'preserved', sections: 0 });
                    continue;
                }
                const r = await withEntityIds(tx, 'website_resources', { key: `page.${page.key}`, type: 'page' as const, createdBy: root.id, updatedBy: root.id });
                await tx.insert(websiteResources).values(r);
                const settings = websitePageSettingsSchema.parse({ displayName: page.displayName, sceneEnabled: page.sceneEnabled, sceneTransitionSeconds: page.sceneEnabled ? 0.42 : null });
                await tx.insert(websiteDrafts).values({ resourceId: r.id, content: settings, updatedBy: root.id });
                let order = 0;
                for (const source of page.sections) {
                    const template = templates.find(t => t.key === source.templateKey)!, definition = templateDefinition(template.key)!;
                    const slots = source.media.map(m => ({ key: m.key, name: m.name, mediaId: mediaMap.get(m.source)! }));
                    function rewrite(field: import('#shared/types/website/section-template').SectionField, value: unknown): unknown {
                        if (field.optional && value === undefined)
                            return undefined;
                        if (field.kind === 'tree') {
                            const node = value as Record<string, unknown>;
                            return { ...Object.fromEntries(Object.entries(field.fields).filter(([key]) => node[key] !== undefined).map(([key, child]) => [key, rewrite(child, node[key])])), ...(Array.isArray(node.children) ? { children: node.children.map(child => rewrite(field, child)) } : {}) };
                        }
                        if (field.kind === 'group')
                            return Object.fromEntries(Object.entries(field.fields ?? {}).filter(([key]) => (value as Record<string, unknown>)?.[key] !== undefined).map(([key, child]) => [key, rewrite(child, (value as Record<string, unknown>)[key])]));
                        if (field.kind === 'list')
                            return (value as unknown[]).map(item => rewrite(field.item!, item));
                        if (field.kind === 'media') {
                            const reference = value as {
                                mediaId: string;
                                presentation?: unknown;
                            }, id = mediaMap.get(reference.mediaId);
                            if (!id)
                                throw new Error('WEBSITE_MEDIA_ASSET_MISSING');
                            return { mediaId: id, ...(reference.presentation ? { presentation: reference.presentation } : {}) };
                        }
                        return value;
                    }
                    const localized = Object.fromEntries(siteLocales.map(l => [l, sectionContentSchema(definition.fields).parse(rewrite(definition.fields, source.localized[l]))]));
                    const section = await withEntityIds(tx, 'website_sections', { resourceId: r.id, templateId: template.id, templateRevision: 1, sortOrder: order++, visible: true, anchorKey: source.anchorKey, sharedContent: { media: slots }, localizedContent: localized, createdBy: root.id, updatedBy: root.id });
                    await tx.insert(websiteSections).values(section);
                    await mediaRepository.replaceReferences(tx, `website:section:${section.id}`, snapshotMedia({ shared: section.sharedContent, localized: section.localizedContent }));
                }
                report.pages.push({ key: page.key, status: page.key === 'products' ? 'placeholder' : 'draft', sections: page.sections.length });
            }
        });
    }
    catch (error) {
        report.failures.push(error instanceof Error ? error.name : 'IMPORT_FAILED');
        for (const item of created) {
            try {
                if (!(await mediaRepository.references(db, [BigInt(item.id)])).length)
                    await media.remove(root.id, item.id, item.version, meta);
            }
            catch {
                report.failures.push(`MEDIA_CLEANUP_REQUIRED:${item.id}`);
            }
        }
        throw error;
    }
    finally {
        await mkdir(reportDirectory, { recursive: true });
        await writeFile(resolve(reportDirectory, `website-import-${id}.json`), JSON.stringify(report, null, 2), { mode: 0o600 });
    }
    return { pages: report.pages, media: { sources: report.media.length, created: created.length, reused: report.media.filter(x => x.reused).length }, published: 0 };
}
