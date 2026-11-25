import {createJiti} from 'jiti'
import {readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {resolve,join} from 'node:path'
import {parse} from 'dotenv'
import {parseArgs} from 'node:util'
import {readPublishedContent} from './lib/read-published-content.mjs'

const root=fileURLToPath(new URL('../',import.meta.url))
const jiti=createJiti(import.meta.url,{alias:{'#shared':join(root,'shared'),'#server':join(root,'server'),'~':join(root,'app')}})

export async function generateSearchIndex({dataFile,outputDir}={}){
 const {searchStoragePath}=await jiti.import('../server/infrastructure/search-storage.ts')
 const {writeSearchIndexes}=await jiti.import('../server/services/search-indexes.ts')
 const envFile=await readFile(resolve(root,'.env'),'utf8').catch(error=>{if(error.code==='ENOENT')return '';throw error})
 const directory=outputDir?resolve(root,outputDir):searchStoragePath(process.env.NUXT_SEARCH_STORAGE_PATH??parse(envFile).NUXT_SEARCH_STORAGE_PATH)
 const snapshots=dataFile?JSON.parse(await readFile(resolve(root,dataFile),'utf8')):await readPublishedContent(root)
 const versions=await writeSearchIndexes(directory,snapshots)
 console.log('[search] Generated '+Object.keys(versions).length+' language indexes from published content')
 return versions
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {values}=parseArgs({options:{data:{type:'string'},output:{type:'string'}}})
 await generateSearchIndex({dataFile:values.data,outputDir:values.output})
}
