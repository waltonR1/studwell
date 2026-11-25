import {afterAll, expect, it, vi} from 'vitest'
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createApp, toWebHandler} from 'h3'

const runtime = vi.hoisted(() => ({directory: ''}))
vi.mock('../../server/runtime/media', () => ({mediaStoragePath: () => runtime.directory}))

import imageHandler from '../../server/runtime/images'

afterAll(async () => {if (runtime.directory) await rm(runtime.directory, {recursive: true, force: true})})

it('serves optimized uploads from runtime storage, including uploads and deletions after startup', async () => {
    runtime.directory = await mkdtemp(join(tmpdir(), 'studwell-images-'))
    await mkdir(join(runtime.directory, 'uploads'))
    const request = toWebHandler(createApp().use(imageHandler))
    const url = 'http://localhost/_ipx/f_webp&w_32/uploads/runtime.svg'
    expect((await request(new Request(url))).status).toBe(404)

    const file = join(runtime.directory, 'uploads/runtime.svg')
    await writeFile(file, '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><rect width="64" height="32" fill="red"/></svg>')
    const response = await request(new Request(url))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/webp')
    expect(Buffer.from(await response.arrayBuffer()).subarray(0, 4).toString()).toBe('RIFF')

    await rm(file)
    expect((await request(new Request(url))).status).toBe(404)
})
