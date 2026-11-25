// Nuxt 装配入口：同一连接池，私有配置，不向客户端暴露原始 Session。
import {useRuntimeConfig} from '#imports'
import {getDatabase} from '../db'
import {createAuthService} from '../services/auth'
import {createRbacService} from '../services/rbac'

export function authRuntime() {
    const config = useRuntimeConfig()
    const database = getDatabase()
    return {
        service: createAuthService(database),
        rbac: createRbacService(database),
        options: {
            origin: config.adminOrigin,
            secureCookie: String(config.adminCookieSecure) !== 'false',
            trustedProxyIps: config.adminTrustedProxyIps.split(',').map(ip => ip.trim()).filter(Boolean)
        }
    }
}
