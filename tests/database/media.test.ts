import {readFile} from 'node:fs/promises'
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp, createRouter, defineEventHandler, toNodeListener } from 'h3';
import { createAuthService, csrfToken } from '../../server/services/auth';
import { mediaHandlers } from '../../server/http/handlers/media-handlers';
import { guardAdminRequest, SESSION_COOKIE } from '../../server/http/auth';
import { ensureRequestId } from '../../server/http/request-id';
import { apiErrorResponse } from '../../server/http/handler';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {recoverMediaDeletes} from '../../server/services/media-recovery';
import {mediaRepository} from '../../server/repositories/media';
import { eq } from 'drizzle-orm';
import { setupTestDatabase, cleanTestDatabase } from './support';
import {seedRoot} from '../../scripts/database/seed/system';
import {createAccountService} from '../../server/services/accounts';
import { createRbacService } from '../../server/services/rbac';
import { createMediaService } from '../../server/services/media';
import { createLocalMediaStorage } from '../../server/infrastructure/media-storage';
import { auditRepository } from '../../server/repositories/audit';
import { adminUsers, mediaAssets, adminOperationLogs } from '../../server/db/schema';
let client: Awaited<ReturnType<typeof setupTestDatabase>>, root: bigint, ordinary: bigint, directory: string;
let server: Server, base: string, token: string;
const options = { origin: 'http://media.test', secureCookie: false };
let media: ReturnType<typeof createMediaService>;
const meta = { ip: '127.0.0.1', userAgent: 'media-fixture', requestId: '00000000-0000-4000-8000-000000000001' };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jNCcAAAAASUVORK5CYII=', 'base64');
const metadata = { name: '测试图片', remark: '业务部门素材' };
const storage = () => createLocalMediaStorage(directory);
const upload = () => media.upload(root, metadata, { bytes: png, filename: 'brand.png', mime: 'image/png' }, meta);
beforeAll(async () => {
    client = await setupTestDatabase();
    root = BigInt((await seedRoot(client.database, 'Media fixture Aurora 8462!')).id);
    ordinary = BigInt((await createAccountService(client.database, false).createOrdinary({ username: 'media_no_access', displayName: '普通账号', password: 'Media fixture Aurora 8462!' }, String(root))).id);
    await client.database.update(adminUsers).set({ mustChangePassword: false });
    await createRbacService(client.database).sync();
    directory = await mkdtemp(join(tmpdir(), 'studwell-media-db-'));
    media = createMediaService(client.database, createLocalMediaStorage(directory));
    const auth = createAuthService(client.database, undefined, false), rbac = createRbacService(client.database);
    const anonymous = await auth.bootstrap(undefined, meta);
    token = (await auth.login(anonymous.raw, 'root', 'Media fixture Aurora 8462!', meta)).raw;
    const app = createApp(), router = createRouter(), handlers = mediaHandlers(client.database, options, createLocalMediaStorage(directory));
    app.use(defineEventHandler(async (event) => { ensureRequestId(event); if (!event.path.startsWith('/api/admin/'))
        return; try {
        await guardAdminRequest(event, auth, options, rbac.authorize);
    }
    catch (error) {
        return apiErrorResponse(event, error);
    } }));
    router.get('/api/admin/media', handlers.list).post('/api/admin/media', handlers.upload);
    router.get('/uploads/:filename',defineEventHandler(event=>handlers.file(event,true)));
    router.get('/api/admin/media/:id/file', defineEventHandler(event => handlers.file(event)));
    app.use(router);
    server = createServer(toNodeListener(app));
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { if (server)
    await new Promise<void>(resolve => server.close(() => resolve())); if (client)
    await cleanTestDatabase(client); if (directory) {
    await rm(directory,{recursive:true,force:true});
} });
describe('媒体事务', () => {
    it('无权限不能读取或上传媒体', async () => {
        await expect(media.list(ordinary, {})).rejects.toMatchObject({ code: 'FORBIDDEN' });
        await expect(media.upload(ordinary, metadata, { bytes: png, filename: 'x.png', mime: 'image/png' }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
    it('审计失败回滚媒体记录并清理上传文件', async () => {
        const files = await readdir(join(directory, 'uploads')).catch(() => []);
        const spy = vi.spyOn(auditRepository, 'audit').mockRejectedValueOnce(new Error('AUDIT_FIXTURE'));
        try { await expect(upload()).rejects.toThrow('AUDIT_FIXTURE'); }
        finally { spy.mockRestore(); }
        expect(await readdir(join(directory, 'uploads')).catch(() => [])).toEqual(files);
        expect((await media.list(root, {})).total).toBe(0);
    });
    it('真实引用阻止删除，解除引用后硬删除且保留审计快照', async () => {
        const asset = await upload();
        expect(asset.createdByName).toBeTruthy();
        await client.database.transaction(tx=>mediaRepository.replaceReferences(tx,'news:fixture',[{mediaId:BigInt(asset.id),field:'cover'}]));
        await expect(media.remove(root,asset.id,asset.version,meta)).rejects.toMatchObject({reason:'REFERENCED'});
        await client.database.transaction(tx=>mediaRepository.replaceReferences(tx,'news:fixture',[]));
        const [row]=await client.database.select().from(mediaAssets).where(eq(mediaAssets.id,BigInt(asset.id)));
        await media.remove(root,asset.id,asset.version,meta);
        expect(await mediaRepository.find(client.database,BigInt(asset.id))).toBeUndefined();
        const logs=await client.database.select().from(adminOperationLogs).where(eq(adminOperationLogs.targetId,asset.id));
        const success=logs.find(log=>log.action==='media.delete' && log.result==='success');
        expect(success?.changeContext).toMatchObject({mode:'delete',fields:expect.arrayContaining([{field:'originalName',before:'brand.png',after:null},{field:'storageKey',before:row!.storageKey,after:null}])});
        await expect(storage().read(row!.storageKey)).rejects.toThrow();
    });
    it('删除审计失败恢复文件和记录，启动恢复中断暂存',async()=>{
        const asset=await upload();const row=(await mediaRepository.find(client.database,BigInt(asset.id)))!;
        const spy=vi.spyOn(auditRepository,'audit').mockRejectedValueOnce(new Error('DELETE_AUDIT_FIXTURE'));
        await expect(media.remove(root,asset.id,asset.version,meta)).rejects.toThrow('DELETE_AUDIT_FIXTURE');spy.mockRestore();
        expect(await storage().read(row.storageKey)).toEqual(png);
        const token=await storage().stage(row.storageKey);
        await recoverMediaDeletes(client.database,storage());expect(await storage().read(row.storageKey)).toEqual(png);
        expect((await storage().staged()).some(item=>item.token===token)).toBe(false);
        await media.remove(root,asset.id,asset.version,meta);
    });
    it('数据库已提交删除后，启动恢复清理遗留暂存而不复活文件',async()=>{
        const asset=await upload(), row=(await mediaRepository.find(client.database,BigInt(asset.id)))!;
        const token=await storage().stage(row.storageKey);
        await client.database.transaction(tx=>mediaRepository.remove(tx,BigInt(asset.id),asset.version));
        await recoverMediaDeletes(client.database,storage());
        expect((await storage().staged()).some(entry=>entry.token===token)).toBe(false);
        await expect(storage().read(row.storageKey)).rejects.toThrow();
    });
    it('引用新增与硬删除并发不会产生悬空引用',async()=>{
        const asset=await upload();
        const results=await Promise.allSettled([
            client.database.transaction(tx=>mediaRepository.replaceReferences(tx,'race:fixture',[{mediaId:BigInt(asset.id),field:'cover'}])),
            media.remove(root,asset.id,asset.version,meta)
        ]);
        expect(results.filter(row=>row.status==='fulfilled')).toHaveLength(1);
        await client.database.transaction(tx=>mediaRepository.replaceReferences(tx,'race:fixture',[]));
        if(await mediaRepository.find(client.database,BigInt(asset.id)))await media.remove(root,asset.id,asset.version,meta);
    });
    it('上传、分页搜索、元数据版本冲突，存储路径不出接口', async () => {
        const asset = await upload();
        expect(asset).toMatchObject({ version: 1, width: 1, height: 1, createdBy: String(root) });
        expect(asset).not.toHaveProperty('storageKey');
        expect((await media.list(root, { search: '测试' })).total).toBe(1);
        expect((await media.list(root, { search: '%' })).total).toBe(0);
        await media.update(root, asset.id, { ...metadata, name: '新名称', version: 1 }, meta);
        await expect(media.update(root, asset.id, { ...metadata, version: 1 }, meta)).rejects.toMatchObject({ code: 'CONFLICT', reason: 'STALE' });
        expect((await media.file(asset.id, root)).bytes).toEqual(png);
        expect((await media.file(asset.id, root)).bytes).toEqual(png);
        await media.remove(root, asset.id, 2, meta);
        await expect(media.file(asset.id, root)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
});
describe('媒体HTTP与权限分离', () => {
    const headers = (csrf = true) => ({ Cookie: `${SESSION_COOKIE}=${token}`, Origin: options.origin, 'X-CSRF-Token': csrf ? csrfToken(token) : 'bad', 'Content-Type': 'image/png' });
    it('拒绝匿名读取、无CSRF上传、格式伪装和实际流量超限', async () => {
        expect((await fetch(base + '/api/admin/media')).status).toBe(401);
        expect((await fetch(base + '/api/admin/media?filename=x.png', { method: 'POST', headers: headers(false), body: png })).status).toBe(403);
        expect((await fetch(base + '/api/admin/media?filename=x.png', { method: 'POST', headers: headers(), body: '<svg/>' })).status).toBe(400);
        expect((await fetch(base + '/api/admin/media?filename=x.png', { method: 'POST', headers: headers(), body: Buffer.alloc(10 * 1024 * 1024 + 1) })).status).toBe(413);
    });
    it('二进制上传即可后台预览且响应保留安全头', async () => {
        const response = await fetch(base + '/api/admin/media?filename=http.png', { method: 'POST', headers: headers(), body: png });
        expect(response.status).toBe(200);
        const { data: asset } = await response.json();
        const preview = await fetch(base + `/api/admin/media/${asset.id}/file`, { headers: headers() });
        expect(preview.status).toBe(200);
        expect(preview.headers.get('content-type')).toBe('image/png');
    });
});

describe('视频上传与播放',()=>{
 const headers=()=>({Cookie:`${SESSION_COOKIE}=${token}`,Origin:options.origin,'X-CSRF-Token':csrfToken(token),'Content-Type':'image/png'})
 it('实际MP4上传，按类型查询及字节段206/416',async()=>{
  const bytes=await readFile('tests/fixtures/media/frontend/videos/company-overview-en.mp4')
  const response=await fetch(base+'/api/admin/media?filename=overview.mp4',{method:'POST',headers:{...headers(),'Content-Type':'video/mp4'},body:bytes})
  expect(response.status).toBe(200);const asset=(await response.json()).data
  expect(asset.kind).toBe('video')
  const stored=(await mediaRepository.find(client.database,BigInt(asset.id)))!;
  const direct=await fetch(base+'/'+stored.storageKey,{headers:{Range:'bytes=0-15'}});expect(direct.status).toBe(206);expect(Buffer.from(await direct.arrayBuffer())).toEqual(bytes.subarray(0,16))
  expect((await media.list(root,{kind:'video'})).items.some(row=>row.id===asset.id)).toBe(true)
  const partial=await fetch(base+`/api/admin/media/${asset.id}/file`,{headers:{...headers(),Range:'bytes=0-31'}})
  expect(partial.status).toBe(206);expect(partial.headers.get('content-range')).toBe(`bytes 0-31/${bytes.length}`)
  expect(Buffer.from(await partial.arrayBuffer())).toEqual(bytes.subarray(0,32))
  const tail=await fetch(base+`/api/admin/media/${asset.id}/file`,{headers:{...headers(),Range:'bytes=-16'}})
  expect(tail.status).toBe(206);expect(Buffer.from(await tail.arrayBuffer())).toEqual(bytes.subarray(-16))
  const invalid=await fetch(base+`/api/admin/media/${asset.id}/file`,{headers:{...headers(),Range:`bytes=${bytes.length}-`}})
  expect(invalid.status).toBe(416)
  await media.remove(root,asset.id,asset.version,meta)
  expect((await fetch(base+`/api/admin/media/${asset.id}/file`,{headers:headers()})).status).toBe(404)
 })
 it('MP4格式伪装不能通过上传',async()=>{
  const response=await fetch(base+'/api/admin/media?filename=fake.mp4',{method:'POST',headers:{...headers(),'Content-Type':'video/mp4'},body:png})
  expect(response.status).toBe(400)
 })
})

