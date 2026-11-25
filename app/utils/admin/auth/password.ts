// 使用 Web Crypto 和 64 字符表生成无取模偏差的候选密码；密码策略由服务端校验。
export function generateInitialPassword(length = 20) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
    return Array.from(crypto.getRandomValues(new Uint8Array(length)), value => alphabet[value & 63]).join('')
}
