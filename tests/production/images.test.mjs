// 显式构建回归：npm run test:production。与 test:db 共用隔离库，不能并行执行。
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtemp, readFile, rm} from 'node:fs/promises'
import {createServer} from 'node:net'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {setTimeout as delay} from 'node:timers/promises'
import {fileURLToPath} from 'node:url'
import {test} from 'node:test'
import {createJiti} from 'jiti'

const root = new URL('../../', import.meta.url)
const path = name => fileURLToPath(new URL(name, root))
const jiti = createJiti(import.meta.url, {alias: {
    '#shared': path('shared'),
    '#section-renderer-inventory': path('scripts/build-section-renderer-inventory.ts'),
}})
const {setupTestDatabase, cleanTestDatabase} = await jiti.import(path('tests/database/support.ts'))
const {seedRoot} = await jiti.import(path('scripts/database/seed/system.ts'))
const {createMediaService} = await jiti.import(path('server/services/media.ts'))
const {createLocalMediaStorage} = await jiti.import(path('server/infrastructure/media-storage.ts'))

test('真实生产路由读取构建静态图片及运行媒体', {timeout: 60_000}, async t => {
    let client, child, closed, directory
    t.after(async () => {
        try {
            if (child?.pid && child.exitCode === null && child.signalCode === null) {
                child.kill()
                await Promise.race([closed, delay(5_000, undefined, {ref: false})])
                if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
            }
            if (closed) await closed
        } finally {
            try { if (client) await cleanTestDatabase(client) }
            finally { if (directory) await rm(directory, {recursive: true, force: true}) }
        }
    })

    client = await setupTestDatabase()
    directory = await mkdtemp(join(tmpdir(), 'studwell-production-images-'))
    const mediaRoot = join(directory, 'media')
    const actor = BigInt((await seedRoot(client.database, 'Production fixture Aurora mist 8462!')).id)
    await client.pool.query('UPDATE admin_users SET must_change_password=FALSE')
    await client.pool.query('UPDATE admin_tasks SET enabled=FALSE,next_run_at=NULL')
    const port = await new Promise((resolve, reject) => {
        const reservation = createServer()
        reservation.once('error', reject)
        reservation.listen(0, '127.0.0.1', () => {
            const value = reservation.address().port
            reservation.close(error => error ? reject(error) : resolve(value))
        })
    })
    const origin = 'http://127.0.0.1:' + port
    // 从临时工作目录启动，不能依赖项目 public 或开发 .env 恰好存在。
    child = spawn(process.execPath, [path('.output/server/index.mjs')], {
        cwd: directory, windowsHide: true,
        env: {...process.env, NODE_ENV: 'production',
            HOST: '127.0.0.1', PORT: String(port), NITRO_HOST: '127.0.0.1', NITRO_PORT: String(port),
            NUXT_DATABASE_URL: process.env.TEST_DATABASE_URL,
            NUXT_ADMIN_ORIGIN: origin, NUXT_ADMIN_COOKIE_SECURE: 'false',
            NUXT_MEDIA_STORAGE_PATH: mediaRoot, NUXT_SEARCH_STORAGE_PATH: join(directory, 'search'),
            NUXT_INQUIRY_SMTP_URL: '',
        }, stdio: ['ignore', 'pipe', 'pipe'],
    })
    let launchError
    child.once('error', error => {launchError = error.code})
    closed = new Promise(resolve => child.once('close', resolve))
    child.stdout.resume()
    child.stderr.resume()
    let ready = false
    for (let attempt = 0; attempt < 100; attempt++) {
        assert(!launchError, '生产进程启动失败：' + launchError)
        assert(child.exitCode === null && child.signalCode === null, '生产进程提前退出')
        try {
            const response = await fetch(origin + '/robots.txt')
            await response.arrayBuffer()
            if (response.ok) {ready = true; break}
        } catch { /* 等待进程开始监听。 */ }
        await delay(150)
    }
    assert(ready, '生产服务未就绪')
    async function webp(url) {
        const response = await fetch(origin + url)
        assert.equal(response.status, 200, url)
        assert.match(response.headers.get('content-type') ?? '', /^image\/webp/)
        assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0, 4).toString(), 'RIFF')
    }

    await t.test('构建 public 的静态 Logo 可以缩放', async () => {
        await webp('/_ipx/f_webp&w_32/brand/studwell-logo.png')
    })
    await t.test('启动后上传可立即缩放，删除后原图及缩放均不可读', async () => {
        const media = createMediaService(client.database, createLocalMediaStorage(mediaRoot))
        const meta = {ip: 'local', userAgent: 'production-images-test', requestId: '00000000-0000-4000-8000-000000000001'}
        const bytes = await readFile(path('public/brand/studwell-logo.png'))
        const asset = await media.upload(actor, {name: '构建回归图片', remark: ''}, {bytes, filename: 'fixture.png', mime: 'image/png'}, meta)
        const [[row]] = await client.pool.query('SELECT storage_key FROM media_assets WHERE id=?', [asset.id])
        const original = '/' + row.storage_key, optimized = '/_ipx/f_webp&w_32' + original
        const response = await fetch(origin + original)
        assert.equal(response.status, 200)
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes)
        await webp(optimized)
        await media.remove(actor, asset.id, asset.version, meta)
        assert.equal((await fetch(origin + original)).status, 404)
        assert.equal((await fetch(origin + optimized)).status, 404)
    })
})
