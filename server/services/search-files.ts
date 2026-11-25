// 校验当前发布状态并读取有效索引；文件访问规则不依赖 HTTP 请求。
import {readSiteModulePolicyVersion} from './site-modules'
import {siteModules} from './site-modules'
import {supportedLocales,type SupportedLocale} from '#shared/config/site-languages'
import {readSiteLanguages,readPublishedSiteContext} from './site-languages'
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {searchStoragePath} from '../infrastructure/search-storage'

import type {Database} from '../db/transaction'

export class SearchFileError extends Error {
    constructor(readonly reason: 'missing' | 'unavailable') { super(reason) }
}

export async function readSearchFile(database: Database, filename: string) {
    const manifest = filename === 'manifest.json'
    const locale=filename.split('.')[0] as SupportedLocale
    if (!manifest && (!/^[a-z]{2}\.[a-f0-9]{16}\.json$/.test(filename)||!supportedLocales.includes(locale)))
        throw new SearchFileError('missing')
    if(!manifest){
        const languages=await database.transaction(tx=>readSiteLanguages(tx),{isolationLevel:'repeatable read'})
        if(!languages.enabledLocales.includes(filename.split('.')[0] as SupportedLocale))throw new SearchFileError('missing')
    }
    try {
        const modules=await siteModules(database)
        const content = await readFile(join(searchStoragePath(),filename),'utf8')
        const active=JSON.parse(manifest?content:await readFile(join(searchStoragePath(),'manifest.json'),'utf8'))
        const {configReleaseId,languageReleaseId}=await database.transaction(tx=>readPublishedSiteContext(tx),{isolationLevel:'repeatable read'})
        if(active.modulePolicyVersion!==await readSiteModulePolicyVersion(database)||active.configReleaseId!==configReleaseId||active.languageReleaseId!==languageReleaseId||Object.entries(modules).some(([key,value])=>active.modules?.[key]!==value))throw new Error('SEARCH_CONFIGURATION_CHANGED')
        if(!manifest&&filename!==locale+'.'+active.versions?.[locale]+'.json')throw new SearchFileError('missing')
        return {content, manifest}
    } catch (cause) {
        if (cause instanceof SearchFileError) throw cause
        if ((cause as NodeJS.ErrnoException).code === 'ENOENT' && !manifest) throw new SearchFileError('missing')
        throw new SearchFileError('unavailable')
    }
}
