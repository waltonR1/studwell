// 协调搜索文档、索引文件和清单发布，不处理搜索 HTTP 请求。
import {createHash} from 'node:crypto'
import {stageSearchFile,cleanupSearchIndexes} from '../infrastructure/search-storage'
import {siteLanguagesSchema} from '#shared/schemas/site-languages'
import {createSearchDocuments,type SearchSnapshot} from './search-documents'
import {searchSchemaVersion} from '#shared/config/website/search'
import {type SearchManifest} from '#shared/types/search'

export async function writeSearchIndexes(directory:string,snapshots:SearchSnapshot[],commit:(activate:()=>Promise<void>)=>Promise<void> = activate=>activate()) {
    // 生成前清理，避免本轮即将激活的旧版本文件在生成后被误删。
    await cleanupSearchIndexes(directory).catch(cause=>{if((cause as NodeJS.ErrnoException).code!=='ENOENT')throw cause})
    const modulePolicyVersion=snapshots[0]?.settings.modulePolicyVersion
    if(!Number.isInteger(modulePolicyVersion)||snapshots.some(snapshot=>snapshot.settings.modulePolicyVersion!==modulePolicyVersion))throw new Error('Search module policy is inconsistent')
    const modules=snapshots[0]?.settings.modules
    if(!modules||snapshots.some(snapshot=>JSON.stringify(snapshot.settings.modules)!==JSON.stringify(modules)))throw new Error('Search modules are inconsistent')
    const languageReleaseId=snapshots[0]?.settings.languageReleaseId??null
    if(snapshots.some(snapshot=>(snapshot.settings.languageReleaseId??null)!==languageReleaseId))throw new Error('Search languages are inconsistent')
    const configReleaseId=snapshots[0]?.settings.configReleaseId??null
    if(snapshots.some(snapshot=>(snapshot.settings.configReleaseId??null)!==configReleaseId))throw new Error('Search configuration is inconsistent')
    const languages=siteLanguagesSchema.parse(snapshots[0]?.settings.languages)
    if(snapshots.length!==languages.enabledLocales.length||snapshots.some(snapshot=>JSON.stringify(snapshot.settings.languages)!==JSON.stringify(languages)))throw new Error('Search languages are inconsistent')
    const indexes = languages.enabledLocales.map(locale => {
        const snapshot = snapshots.find(value => value.locale === locale)
        if (!snapshot) throw new Error('Missing published search locale '+locale)
        const documents = createSearchDocuments(snapshot), ids = new Set(), paths = new Set()
        for (const doc of documents) {
            if (!doc.title.trim() || !doc.summary.trim() || ids.has(doc.id) || paths.has(doc.path) || !/^\/(?!\/)[a-z0-9_/-]*$/.test(doc.path))
                throw new Error('Invalid search document '+doc.id)
            ids.add(doc.id)
            paths.add(doc.path)
        }
        const version = createHash('sha256').update(JSON.stringify({schemaVersion:searchSchemaVersion,configReleaseId,languageReleaseId,documents})).digest('hex').slice(0,16)
        return {schemaVersion:searchSchemaVersion,version,locale,documents}
    })
    for (const index of indexes) {
        await stageSearchFile(directory,index.locale+'.'+index.version+'.json',JSON.stringify(index)+'\n',activate=>activate())
    }
    const versions = Object.fromEntries(indexes.map(({locale,version})=>[locale,version])) as SearchManifest['versions']
    // 在任务确认仍持有执行权后切换清单；旧索引保持可读。
    await stageSearchFile(directory,'manifest.json',JSON.stringify({schemaVersion:searchSchemaVersion,configReleaseId,languageReleaseId,modulePolicyVersion,languages,versions,modules})+'\n',commit)
    return versions
}
