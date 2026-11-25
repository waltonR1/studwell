import {fileURLToPath} from 'node:url'
import {resolve} from 'node:path'
import {fromWebHandler, lazyEventHandler} from 'h3'
import {createIPX, createIPXFetchHandler, ipxFSStorage, parseIPXURL} from 'ipx'
import {mediaStoragePath} from './media'

// 上传图片读取持久化目录；静态图片读取部署产物，避免上传后还需重新构建。
export default lazyEventHandler(() => {
    const uploads = ipxFSStorage({dir: mediaStoragePath()})
    const assets = ipxFSStorage({dir: import.meta.dev ? resolve('public') : fileURLToPath(new URL('../public/', import.meta.url))})
    const storage = (id: string) => id.replace(/^\/+/, '').startsWith('uploads/') ? uploads : assets
    const ipx = createIPX({storage: {
        name: 'site-images',
        getMeta: (id, options) => storage(id).getMeta(id, options),
        getData: (id, options) => storage(id).getData(id, options),
    }})
    const handler = createIPXFetchHandler(ipx, {
        parseURL(url) {
            const parsed = new URL(url)
            parsed.pathname = parsed.pathname.replace(/^\/_ipx(?=\/|$)/, '') || '/'
            return parseIPXURL(parsed.href)
        },
    })
    return fromWebHandler(async request => handler(request))
})
