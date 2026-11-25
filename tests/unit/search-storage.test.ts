import {expect,it} from 'vitest'
import {mkdtemp,writeFile,utimes,readdir,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {cleanupSearchIndexes} from '../../server/infrastructure/search-storage'

it('只清理过期且不被当前清单引用的索引，保留新文件和其他资源',async()=>{
    const directory=await mkdtemp(join(tmpdir(),'search-retention-'))
    const active='en.1111111111111111.json',old='en.2222222222222222.json',fresh='fr.3333333333333333.json'
    try {
        await writeFile(join(directory,'manifest.json'),JSON.stringify({versions:{en:'1111111111111111'}}))
        for(const name of [active,old,fresh,'notes.json'])await writeFile(join(directory,name),'{}')
        const expired=new Date(Date.now()-2*24*60*60*1000)
        for(const name of [active,old,'notes.json'])await utimes(join(directory,name),expired,expired)
        await cleanupSearchIndexes(directory)
        expect((await readdir(directory)).sort()).toEqual([active,fresh,'manifest.json','notes.json'].sort())
    } finally {await rm(directory,{recursive:true,force:true})}
})
