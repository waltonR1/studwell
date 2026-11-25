import {createJiti} from 'jiti'
import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {parse} from 'dotenv'

export async function readPublishedContent(root) {
 const jiti=createJiti(import.meta.url,{alias:{'#shared':resolve(root,'shared'),'#server':resolve(root,'server'),'~':resolve(root,'app')}})
 const [{createDatabaseClient},{readSearchSnapshots}]=await Promise.all([
  jiti.import('../../server/db/client.ts'),jiti.import('../../server/services/published-search.ts'),
 ])
 const file=await readFile(resolve(root,'.env'),'utf8').catch(error=>{if(error.code==='ENOENT')return '';throw error})
 const environment={...parse(file),...process.env}
 if(!environment.NUXT_DATABASE_URL)throw new Error('Search generation requires NUXT_DATABASE_URL or --data published snapshots')
 const client=createDatabaseClient(environment.NUXT_DATABASE_URL)
 try {
  return await readSearchSnapshots(client.database)
 } finally {await client.pool.end()}
}
