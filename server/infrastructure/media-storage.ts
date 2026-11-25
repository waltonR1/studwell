// 实现本地媒体文件存储、读取和删除，不决定业务引用关系。
import type {MediaStorage} from '../core/media-storage'
import { mkdir, readFile, writeFile, unlink, open, realpath, rename, readdir, rm } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
// 不使用原文件名作为路径；目录由部署配置注入，不允许请求修改。
export function createLocalMediaStorage(directory: string): MediaStorage {
    const base = resolve(directory);
    const path = (key: string) => {
        if (!/^[a-zA-Z0-9_@./-]{1,80}$/.test(key) || key.startsWith('/') || key.split('/').some(part => !part || part === '.' || part === '..'))
            throw new Error('INVALID_STORAGE_KEY');
        return join(base, key);
    };
    const existingPath = async (key: string) => {
        const target=await realpath(path(key)), root=await realpath(base)
        // realpath 先解析链接，再按当前平台的路径规则检查目录归属。
        const location = relative(root, target)
        if(!location || location === '..' || location.startsWith('..' + sep) || isAbsolute(location))throw new Error('INVALID_STORAGE_KEY')
        return target
    }
    const trash = resolve(base, '../.data/media-trash', createHash('sha256').update(base).digest('hex').slice(0,16));
    const tokenPath = (token: string) => {if(!/^[a-f0-9-]{36}$/.test(token))throw new Error('INVALID_TRASH_TOKEN');return join(trash,token)};
    return {
        async put(bytes, extension) {
            if(!/^(png|jpg|webp|ico|mp4)$/.test(extension))throw new Error('INVALID_STORAGE_EXTENSION')
            await mkdir(join(base,'uploads'), { recursive: true, mode: 0o755 });
            const key = `uploads/${randomUUID()}.${extension}`;
            await writeFile(path(key), bytes, { flag: 'wx', mode: 0o644 });
            return key;
        },
        read: async key => readFile(await existingPath(key)),
        async range(key,start,end) {
            const file=await open(await existingPath(key),'r')
            try {
                const bytes=Buffer.alloc(end-start+1)
                let offset=0
                while(offset<bytes.length){const result=await file.read(bytes,offset,bytes.length-offset,start+offset);if(!result.bytesRead)throw new Error('MEDIA_FILE_TRUNCATED');offset+=result.bytesRead}
                return bytes
            } finally {await file.close()}
        },
        async stage(key) {
            const token = randomUUID(), directory = tokenPath(token);
            await mkdir(directory,{recursive:true,mode:0o700});
            await writeFile(join(directory,'key.json'),JSON.stringify({key}),{flag:'wx'});
            await rename(await existingPath(key),join(directory,'file'));
            return token;
        },
        async restore(token) {
            const directory=tokenPath(token), {key}=JSON.parse(await readFile(join(directory,'key.json'),'utf8'));
            try {await rename(join(directory,'file'),path(key));} catch(error) {if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
            await rm(directory,{recursive:true});
        },
        async purge(token) {await rm(tokenPath(token),{recursive:true,force:true});},
        async staged() {
            const entries = await readdir(trash).catch(error=>{if(error.code==='ENOENT')return [];throw error});
            return Promise.all(entries.map(async token=>({token,key:JSON.parse(await readFile(join(tokenPath(token),'key.json'),'utf8')).key as string})));
        },
        async remove(key) { await unlink(await existingPath(key)); },
    };
}
