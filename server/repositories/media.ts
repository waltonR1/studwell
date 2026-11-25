// 负责媒体的数据库查询与持久化，使用调用方传入的执行器，不决定 HTTP 响应或业务授权。
import { and, count, desc, eq, inArray, like, lt, or, sql } from 'drizzle-orm';
import { mediaAssets as assets, mediaReferences as refs, adminUsers } from '../db/schema';
import type { DatabaseExecutor } from '../db/transaction';
import { withEntityIds } from '../db/allocate-entity-id';
import { MAX_ENTITY_VERSION } from '#shared/config/entity-versions';
const referenceIds=(ids:bigint[])=>[...new Set(ids)].sort((a,b)=>a<b?-1:a>b?1:0);
export const mediaRepository = {
    async list(db: DatabaseExecutor, query: {
        page: number;
        pageSize: number;
        search?: string;
        kind?: 'image' | 'video';
    }) {
        const keyword = query.search?.replace(/[\\%_]/g, '\\$&');
        const filter = and(query.kind ? eq(assets.kind, query.kind) : undefined, keyword ? or(like(assets.name, `%${keyword}%`), like(assets.originalName, `%${keyword}%`)) : undefined);
        const items = await db.select().from(assets).where(filter).orderBy(desc(assets.createdAt), desc(assets.id)).limit(query.pageSize).offset((query.page - 1) * query.pageSize);
        const [total] = await db.select({ value: count() }).from(assets).where(filter);
        return { items, total: total!.value, page: query.page, pageSize: query.pageSize };
    },
    async creatorNames(db: DatabaseExecutor, ids: bigint[]) {
        return ids.length ? db.select({id: adminUsers.id, name: adminUsers.displayName}).from(adminUsers).where(inArray(adminUsers.id, ids)) : [];
    },
    async find(db: DatabaseExecutor, id: bigint, lock = false) {
        const query = db.select().from(assets).where(eq(assets.id, id)).limit(1);
        return (await (lock ? query.for('update') : query))[0];
    },
    async findByStorageKey(db: DatabaseExecutor, storageKey: string) {
        return (await db.select().from(assets).where(eq(assets.storageKey,storageKey)).limit(1))[0]
    },
    async insert(db: DatabaseExecutor, input: typeof assets.$inferInsert) {
        const row = await withEntityIds(db, 'media_assets', input);
        await db.insert(assets).values(row);
        return row.id;
    },
    async update(db: DatabaseExecutor, id: bigint, version: number, fields: Partial<typeof assets.$inferInsert>) {
        const [result] = await db.update(assets).set({ ...fields, version: sql `${assets.version}+1`, updatedAt: new Date() }).where(and(eq(assets.id, id), eq(assets.version, version), lt(assets.version, MAX_ENTITY_VERSION)));
        return result.affectedRows === 1;
    },
    async references(db: DatabaseExecutor, ids: bigint[]) {
        return ids.length ? db.select().from(refs).where(inArray(refs.mediaId,ids)) : [];
    },
    async remove(db: DatabaseExecutor, id: bigint, version: number) {
        const [result] = await db.delete(assets).where(and(eq(assets.id,id),eq(assets.version,version)));
        return result.affectedRows === 1;
    },
    async removeReferencesForOwners(db:DatabaseExecutor,owners:string[]){
        if(!owners.length)return;
        const old=await db.select().from(refs).where(inArray(refs.owner,owners));
        for(const id of referenceIds(old.map(row=>row.mediaId)))if(!await this.find(db,id,true))throw new Error('MEDIA_REFERENCE_NOT_FOUND');
        await db.delete(refs).where(inArray(refs.owner,owners));
    },
    // 调用者在自己的内容事务中，先按ID顺序锁定所有旧/新媒体，再替换引用。
    async replaceReferences(db: DatabaseExecutor, owner: string, entries: Array<{mediaId:bigint;field:string}>) {
        const old = await db.select().from(refs).where(eq(refs.owner,owner));
        const ids = referenceIds([...old.map(row=>row.mediaId),...entries.map(row=>row.mediaId)]);
        for (const id of ids) if (!await this.find(db,id,true)) throw new Error('MEDIA_REFERENCE_NOT_FOUND');
        await db.delete(refs).where(eq(refs.owner,owner));
        if(entries.length) await db.insert(refs).values(await withEntityIds(db,'media_references',entries.map(entry=>({...entry,owner}))));
    },
};
