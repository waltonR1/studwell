// 解析搜索文件存储位置并暂存文件，发布协调由服务层处理。
import {randomUUID} from 'node:crypto'
import {mkdir,rename,rm,writeFile,readdir,stat,readFile} from 'node:fs/promises'
import {join,resolve} from 'node:path'

export function searchStoragePath(path = process.env.NUXT_SEARCH_STORAGE_PATH) {
    return resolve(path?.trim() || '.data/search')
}

// 只清理超过一天且不再被当前清单引用的版本文件，保留在途生成文件。
export async function cleanupSearchIndexes(directory:string, now=Date.now()) {
    const manifest=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8')) as {versions:Record<string,string>}
    const active=new Set(Object.entries(manifest.versions).map(([locale,version])=>`${locale}.${version}.json`))
    for(const filename of await readdir(directory)) {
        if(!/^[a-z]{2}\.[a-f0-9]{16}\.json$/.test(filename)||active.has(filename))continue
        const target=join(directory,filename)
        const info=await stat(target)
        if(info.isFile()&&now-info.mtimeMs>24*60*60*1000)await rm(target,{force:true})
    }
}

export async function stageSearchFile(directory:string,filename:string,content:string,commit:(activate:()=>Promise<void>)=>Promise<void>) {
    await mkdir(directory,{recursive:true})
    const target = join(directory,filename), pending = join(directory,'.'+randomUUID()+'.tmp')
    try {
        await writeFile(pending,content,{encoding:'utf8',flag:'wx'})
        await commit(() => rename(pending,target))
    } finally {
        await rm(pending,{force:true}).catch(() => {})
    }
}
