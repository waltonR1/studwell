import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, mkdir, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep, basename } from 'node:path';
import { inspectMediaFile } from '../../server/policies/media-file';
import { createLocalMediaStorage } from '../../server/infrastructure/media-storage';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jNCcAAAAASUVORK5CYII=', 'base64');
let directory = '';
afterEach(async () => { if (directory) {
    const target = resolve(directory)
    if (!target.startsWith(resolve(tmpdir()) + sep) || !basename(target).startsWith('studwell-media-unit-'))
        throw new Error('UNEXPECTED_TEST_CLEANUP_PATH')
    await rm(directory,{recursive:true,force:true});
    directory = '';
} });
describe('媒体文件边界', () => {
    it('ICO接受常见MIME，校验目录与DIB内容，并可原样存储读取', async () => {
        const ico=await readFile('tests/fixtures/media/sample.ico');
        for(const mime of ['image/x-icon','image/vnd.microsoft.icon'])expect(inspectMediaFile(ico,'favicon.ico',mime)).toMatchObject({mime:'image/vnd.microsoft.icon',kind:'image',width:32,height:32});
        for(const mime of ['image/png','text/html'])expect(()=>inspectMediaFile(ico,'favicon.ico',mime)).toThrow();
        expect(()=>inspectMediaFile(ico,'favicon.png','image/x-icon')).toThrow();
        const invalidOffset=Buffer.from(ico);invalidOffset.writeUInt32LE(ico.length,18);
        const invalidDimensions=Buffer.from(ico);invalidDimensions[6]=64;
        for(const bytes of [ico.subarray(0,10),ico.subarray(0,ico.length-1),invalidOffset,invalidDimensions,png])expect(()=>inspectMediaFile(bytes,'favicon.ico','image/x-icon')).toThrow();
        directory=await mkdtemp(join(tmpdir(),'studwell-media-unit-'));
        const storage=createLocalMediaStorage(directory),key=await storage.put(ico,'ico');
        expect(key).toMatch(/\.ico$/);expect(await storage.read(key)).toEqual(ico);
    });
    it('ICO支持内嵌PNG与多个尺寸，拒绝重叠和伪装图像', () => {
        const ico=Buffer.alloc(22+png.length);ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);ico[6]=1;ico[7]=1;ico.writeUInt32LE(png.length,14);ico.writeUInt32LE(22,18);png.copy(ico,22);
        expect(inspectMediaFile(ico,'favicon.ico','image/x-icon')).toMatchObject({width:1,height:1});
        const multi=Buffer.alloc(38+png.length*2);ico.copy(multi,0,0,22);multi.writeUInt16LE(2,4);multi.writeUInt32LE(38,18);multi.copy(multi,22,6,22);multi.writeUInt32LE(38+png.length,34);png.copy(multi,38);png.copy(multi,38+png.length);
        expect(inspectMediaFile(multi,'favicon.ico','image/x-icon')).toMatchObject({width:1,height:1});
        multi.writeUInt32LE(38,34);expect(()=>inspectMediaFile(multi,'favicon.ico','image/x-icon')).toThrow();
        ico.fill(0,22);expect(()=>inspectMediaFile(ico,'favicon.ico','image/x-icon')).toThrow();
    });
    it('字节、扩展名和MIME需匹配，拒绝SVG、格式伪装、超限和异常像素', () => {
        expect(inspectMediaFile(png, 'image.png', 'image/png')).toMatchObject({ width: 1, height: 1, kind: 'image', size: png.length });
        for (const [bytes, name, mime] of [[png, 'image.jpg', 'image/jpeg'], [png, 'image.png', 'text/html'], [Buffer.from('<svg/>'), 'image.svg', 'image/svg+xml']] as const)
            expect(() => inspectMediaFile(bytes, name, mime)).toThrow();
        expect(() => inspectMediaFile(Buffer.alloc(10 * 1024 * 1024 + 1), 'huge.png', 'image/png')).toThrow();
        const huge = Buffer.from(png);
        huge.writeUInt32BE(20001, 16);
        expect(() => inspectMediaFile(huge, 'large.png', 'image/png')).toThrow();
        expect(() => inspectMediaFile(Buffer.from('%PDF-1.7\nfixture\n%%EOF'), 'a.pdf', 'application/pdf')).toThrow();
    });
    it('检查独立WebP样本的图像尺寸', async () => {
        const webp = await readFile('tests/fixtures/media/sample.webp');
        expect(inspectMediaFile(webp, 'cement.webp', 'image/webp')).toMatchObject({ kind: 'image' });
    });
    it('随机存储键不可覆盖，拒绝路径穿越，移除只影响指定文件', async () => {
        directory = await mkdtemp(join(tmpdir(), 'studwell-media-unit-'));
        const storage = createLocalMediaStorage(directory);
        const a = await storage.put(png, 'png'), b = await storage.put(png, 'png');
        expect(a).not.toBe(b);
        expect(await storage.read(a)).toEqual(png);
        expect(await storage.range(a, 0, 7)).toEqual(png.subarray(0, 8));
        await expect(storage.read('../private')).rejects.toThrow('INVALID_STORAGE_KEY');
        await storage.remove(a);
        await expect(storage.read(a)).rejects.toThrow();
        expect(await storage.read(b)).toEqual(png);
    });
    it('拒绝通过目录链接访问同名前缀的外部目录，外部文件保持完整', async () => {
        directory = await mkdtemp(join(tmpdir(), 'studwell-media-unit-'));
        const root = join(directory, 'media'), outside = join(directory, 'media-other');
        await mkdir(join(root, 'uploads'), {recursive: true});
        await mkdir(outside);
        const externalFile = join(outside, 'private.png');
        await writeFile(externalFile, png);
        await symlink(outside, join(root, 'uploads', 'outside'), process.platform === 'win32' ? 'junction' : 'dir');
        const storage = createLocalMediaStorage(root), key = 'uploads/outside/private.png';
        await expect(storage.read(key)).rejects.toThrow('INVALID_STORAGE_KEY');
        await expect(storage.range(key, 0, 7)).rejects.toThrow('INVALID_STORAGE_KEY');
        await expect(storage.remove(key)).rejects.toThrow('INVALID_STORAGE_KEY');
        await expect(storage.stage(key)).rejects.toThrow('INVALID_STORAGE_KEY');
        expect(await readFile(externalFile)).toEqual(png);
    });
});
