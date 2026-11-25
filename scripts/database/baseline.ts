// 只读核对当前 Schema、引用及发布投影；供 CLI 和空库/升级测试共用。
import {getTableConfig} from 'drizzle-orm/mysql-core'
import {is} from 'drizzle-orm'
import {MySqlTable} from 'drizzle-orm/mysql-core'
import {isDeepStrictEqual} from 'node:util'
import type {RowDataPacket} from 'mysql2'
import type {PoolConnection} from 'mysql2/promise'
import * as schema from '../../server/db/schema'
import type {createDatabaseClient} from '../../server/db/client'
import {siteLanguagesSchema} from '../../shared/schemas/site-languages'
import {websiteModulePolicySchema} from '../../shared/schemas/website/module-policy'
import {moduleImageRulesSchema} from '../../shared/schemas/admin/image-rules'
import {sectionTemplateRevisionSchema} from '../../shared/schemas/admin/section-template'
import {publishedPageSnapshotSchema} from '../../server/policies/public-website-snapshot'
import {siteSettingsSchema} from '../../shared/schemas/admin/site-settings'

export async function checkDatabaseBaseline(client:ReturnType<typeof createDatabaseClient>) {
    const connection=await client.pool.getConnection()
    try {
        await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
        await connection.query('START TRANSACTION READ ONLY')
        return await inspectDatabaseBaseline(connection)
    } finally {
        try {await connection.rollback()} finally {connection.release()}
    }
}

async function inspectDatabaseBaseline(connection:PoolConnection) {
    const failures:string[]=[]
    const tables=Object.values(schema).filter(value=>is(value,MySqlTable)).map(table=>getTableConfig(table))
    const [columns]=await connection.query<RowDataPacket[]>('SELECT TABLE_NAME AS tableName,COLUMN_NAME AS columnName,COLUMN_TYPE AS columnType,IS_NULLABLE AS nullable FROM information_schema.columns WHERE table_schema=DATABASE()')
    const [indexes]=await connection.query<RowDataPacket[]>('SELECT TABLE_NAME AS tableName,INDEX_NAME AS name,NON_UNIQUE AS nonUnique,COLUMN_NAME AS columnName FROM information_schema.statistics WHERE table_schema=DATABASE() ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX')
    const [foreignKeys]=await connection.query<RowDataPacket[]>('SELECT k.TABLE_NAME AS tableName,k.CONSTRAINT_NAME AS name,k.COLUMN_NAME AS columnName,k.REFERENCED_TABLE_NAME AS targetTable,k.REFERENCED_COLUMN_NAME AS targetColumn,r.DELETE_RULE AS deleteRule FROM information_schema.key_column_usage k JOIN information_schema.referential_constraints r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME AND r.TABLE_NAME=k.TABLE_NAME WHERE k.TABLE_SCHEMA=DATABASE() ORDER BY k.TABLE_NAME,k.CONSTRAINT_NAME,k.ORDINAL_POSITION')
    const [constraints]=await connection.query<RowDataPacket[]>('SELECT TABLE_NAME AS tableName,CONSTRAINT_NAME AS name,ENFORCED AS enforced FROM information_schema.table_constraints WHERE CONSTRAINT_SCHEMA=DATABASE() AND CONSTRAINT_TYPE=\'CHECK\'')
    const normalize=(value:string)=>value.toLowerCase().replace(/boolean/g,'tinyint').replace(/tinyint\(1\)/g,'tinyint').replace(/\s+/g,' ')
    const expected=new Set(tables.map(table=>table.name))
    for(const name of new Set(columns.map(row=>String(row.tableName))))if(name!=='__drizzle_migrations'&&!expected.has(name))failures.push(`unexpected table: ${name}`)
    for(const table of tables){
        const actual=columns.filter(row=>row.tableName===table.name)
        for(const column of table.columns){
            const stored=actual.find(row=>row.columnName===column.name)
            if(!stored)failures.push(`missing column: ${table.name}.${column.name}`)
            else if(normalize(stored.columnType)!==normalize(column.getSQLType()))failures.push(`column type: ${table.name}.${column.name}`)
            else if((stored.nullable==='NO')!==column.notNull)failures.push(`column nullability: ${table.name}.${column.name}`)
        }
        for(const column of actual)if(!table.columns.some(value=>value.name===column.columnName))failures.push(`unexpected column: ${table.name}.${column.columnName}`)
        const tableIndexes=indexes.filter(row=>row.tableName===table.name)
        const indexPresent=(names:string[],unique:boolean,primary=false)=>[...new Set(tableIndexes.map(row=>row.name))].some(name=>{
            if(primary&&name!=='PRIMARY')return false
            const parts=tableIndexes.filter(row=>row.name===name)
            return Boolean(Number(parts[0]!.nonUnique))===!unique&&isDeepStrictEqual(parts.map(row=>row.columnName),names)
        })
        const primary=table.primaryKeys.flatMap(key=>key.columns.map(column=>column.name))
        const primaryColumns=primary.length?primary:table.columns.filter(column=>column.primary).map(column=>column.name)
        if(primaryColumns.length&&!indexPresent(primaryColumns,true,true))failures.push(`primary key: ${table.name}`)
        for(const index of table.indexes){
            const names=index.config.columns.map(column=>'name' in column?column.name:undefined)
            if(names.every((name):name is string=>typeof name==='string')&&!indexPresent(names,Boolean(index.config.unique)))failures.push(`index: ${table.name}.${index.config.name}`)
        }
        for(const foreignKey of table.foreignKeys){
            const reference=foreignKey.reference(),target=getTableConfig(reference.foreignTable).name
            const rows=foreignKeys.filter(row=>row.tableName===table.name)
            const found=[...new Set(rows.map(row=>row.name))].some(name=>{
                const parts=rows.filter(row=>row.name===name)
                return parts[0]!.targetTable===target&&parts[0]!.deleteRule.toLowerCase()===(foreignKey.onDelete??'no action')&&isDeepStrictEqual(parts.map(row=>row.columnName),reference.columns.map(column=>column.name))&&isDeepStrictEqual(parts.map(row=>row.targetColumn),reference.foreignColumns.map(column=>column.name))
            })
            if(!found)failures.push(`foreign key: ${table.name}.${foreignKey.getName()}`)
        }
        for(const check of table.checks)if(!constraints.some(row=>row.tableName===table.name&&row.name===check.name&&row.enforced==='YES'))failures.push(`check constraint: ${table.name}.${check.name}`)
    }
    const checks:Record<string,string>={
        websiteHash:'SELECT COUNT(*) AS n FROM website_releases WHERE content_hash<>SHA2(CAST(content AS CHAR CHARACTER SET utf8mb4),256)',
        newsHash:'SELECT COUNT(*) AS n FROM news_releases WHERE content_hash<>SHA2(CAST(content AS CHAR CHARACTER SET utf8mb4),256)',
        resourceDraft:'SELECT COUNT(*) AS n FROM website_resources r LEFT JOIN website_drafts d ON d.resource_id=r.id WHERE d.resource_id IS NULL',
        navigationTarget:'SELECT COUNT(*) AS n FROM website_navigation n LEFT JOIN website_resources r ON r.id=n.target_resource_id WHERE n.target_resource_id IS NOT NULL AND r.id IS NULL',
        mediaAsset:'SELECT COUNT(*) AS n FROM media_references r LEFT JOIN media_assets a ON a.id=r.media_id WHERE a.id IS NULL',
        mediaOwner:`SELECT COUNT(*) AS n FROM (SELECT DISTINCT owner FROM media_references) r WHERE NOT (
            EXISTS(SELECT 1 FROM website_drafts d WHERE r.owner=CONCAT('website:draft:',d.resource_id)) OR
            EXISTS(SELECT 1 FROM website_sections s WHERE r.owner=CONCAT('website:section:',s.id)) OR
            EXISTS(SELECT 1 FROM website_releases p WHERE r.owner=CONCAT('website:release:',p.id)) OR
            EXISTS(SELECT 1 FROM website_templates t WHERE r.owner=CONCAT('website:template:',t.id)) OR
            EXISTS(SELECT 1 FROM website_resources p WHERE r.owner=CONCAT('website:seo:',p.id)) OR
            EXISTS(SELECT 1 FROM website_site_config_releases c WHERE r.owner=CONCAT('website:config:',c.id)) OR
            EXISTS(SELECT 1 FROM news_articles a WHERE r.owner=CONCAT('news:draft:',a.id)) OR
            EXISTS(SELECT 1 FROM news_releases p WHERE r.owner=CONCAT('news:release:',p.id)))`,
        languageHistory:'SELECT COUNT(*) AS n FROM website_language_releases r LEFT JOIN website_language_releases p ON p.id=r.restored_from WHERE r.restored_from IS NOT NULL AND p.id IS NULL',
        routeHistory:'SELECT COUNT(*) AS n FROM website_site_config_releases r LEFT JOIN website_site_config_releases p ON p.id=r.restored_from WHERE r.restored_from IS NOT NULL AND p.id IS NULL',
        publicRenderer:"SELECT COUNT(*) AS n FROM website_template_revisions v LEFT JOIN website_renderers r ON r.scope='public' AND r.renderer_key=JSON_UNQUOTE(JSON_EXTRACT(v.definition,'$.publicRendererId')) WHERE r.renderer_key IS NULL",
        previewRenderer:"SELECT COUNT(*) AS n FROM website_template_revisions v LEFT JOIN website_renderers r ON r.scope='preview' AND r.renderer_key=JSON_UNQUOTE(JSON_EXTRACT(v.definition,'$.previewRendererId')) WHERE r.renderer_key IS NULL",
    }
    for(const [name,query]of Object.entries(checks)){
        const [[row]]=await connection.query<RowDataPacket[]>(query)
        if(Number(row!.n)!==0)failures.push(`${name}: ${row!.n}`)
    }
    for(const name of ['website_site_config','website_language_config','website_module_policy','website_image_rules','news_operations','customer_inquiry_settings']){
        const [[row]]=await connection.query<RowDataPacket[]>(`SELECT COUNT(*) AS n,SUM(id=1) AS valid FROM ${name}`)
        if(Number(row!.n)!==1||Number(row!.valid)!==1)failures.push(`singleton: ${name}`)
    }
    const jsonContracts=[
        {query:'SELECT languages AS content FROM website_language_config',contract:siteLanguagesSchema,name:'language draft'},
        {query:'SELECT content FROM website_language_releases',contract:siteLanguagesSchema,name:'language release'},
        {query:'SELECT policy AS content FROM website_module_policy',contract:websiteModulePolicySchema,name:'module policy'},
        {query:'SELECT rules AS content FROM website_image_rules',contract:moduleImageRulesSchema,name:'image rules'},
        {query:'SELECT definition AS content FROM website_template_revisions',contract:sectionTemplateRevisionSchema,name:'template revision'},
    ]
    for(const {query,contract,name}of jsonContracts){
        const [rows]=await connection.query<RowDataPacket[]>(query)
        const invalid=rows.filter(row=>!contract.safeParse(row.content).success).length
        if(invalid)failures.push(`${name} JSON: ${invalid}`)
    }
    const [snapshots]=await connection.query<RowDataPacket[]>('SELECT r.content,s.resource_type AS type FROM website_releases r JOIN website_resources s ON s.id=r.resource_id')
    for(const type of ['page','basic','header','footer'] as const){
        const contract=type==='page'?publishedPageSnapshotSchema:siteSettingsSchema.shape[type]
        const invalid=snapshots.filter(row=>row.type===type&&!contract.safeParse(row.content).success).length
        if(invalid)failures.push(`${type} release JSON: ${invalid}`)
    }
    const [[release]]=await connection.query<RowDataPacket[]>('SELECT r.content FROM website_site_config c JOIN website_site_config_releases r ON r.id=c.published_release_id WHERE c.id=1')
    if(release){
        const content=release.content as {routes:Array<{path:string;resourceId:string;enabled?:boolean}>;seo:Record<string,unknown>[]}
        const [routes]=await connection.query<RowDataPacket[]>('SELECT path,resource_id FROM website_published_routes')
        const [seo]=await connection.query<RowDataPacket[]>('SELECT * FROM website_published_seo')
        const expectedRoutes=content.routes.filter(row=>row.enabled!==false).map(row=>`${row.path}:${row.resourceId}`).sort()
        if(!isDeepStrictEqual(expectedRoutes,routes.map(row=>`${row.path}:${row.resource_id}`).sort()))failures.push('published routes projection')
        const seoKey=(row:Record<string,unknown>)=>JSON.stringify([String(row.resourceId??row.resource_id),row.locale,row.title,row.description,Boolean(row.indexable),row.ogTitle??row.og_title,row.ogDescription??row.og_description,String(row.ogMediaId??row.og_media_id??'')])
        if(!isDeepStrictEqual(content.seo.map(seoKey).sort(),seo.map(seoKey).sort()))failures.push('published SEO projection')
    }else{
        const [[row]]=await connection.query<RowDataPacket[]>('SELECT (SELECT COUNT(*) FROM website_published_routes)+(SELECT COUNT(*) FROM website_published_seo) AS n')
        if(Number(row!.n)!==0)failures.push('published projections without release')
    }
    return {ok:failures.length===0,tables:tables.length,failures}
}
