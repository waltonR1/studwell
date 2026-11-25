// 弱口令名单维护：npm run password:blocklist:update，联网导入 SecLists 的固定提交。
// 重新运行会覆盖本地名单、许可证和来源元数据；获取新版本需先人工审查并修改 commit。
// 只处理公开常见密码数据，不读取真实账号密码；安装、构建和登录不会自动运行本脚本。
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
const commit = '0c03d70db30ceedb941ac58b0ec910eb85906d6f'
const path = 'Passwords/Common-Credentials/xato-net-10-million-passwords-100000.txt'
const base = `https://raw.githubusercontent.com/danielmiessler/SecLists/${commit}`
async function read(path) {
  // 优先 GitHub Contents API，失败后尝试原始文件地址；两个入口始终绑定同一提交。
  for (const url of [`https://api.github.com/repos/danielmiessler/SecLists/contents/${path}?ref=${commit}`, `${base}/${path}`]) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'studwell-security-data-import' }, signal: AbortSignal.timeout(30000) })
      if (response.ok) {
        if (url.startsWith('https://api.github.com/')) {
          const result = await response.json()
          if (result.encoding === 'base64' && typeof result.content === 'string') return Buffer.from(result.content, 'base64').toString('utf8')
        } else return await response.text()
      }
    } catch { /* 同一提交的备用下载入口，不更换版本或数据源。 */ }
  }
  throw new Error('固定来源下载失败，未更新本地数据')
}
const source = await read(path)
if (source.split('\n').length < 90000) throw new Error('来源数据规模不符合预期')
const license = await read('LICENSE')
if (!license.includes('MIT License')) throw new Error('来源许可不符合预期')
const sha256 = text => createHash('sha256').update(text).digest('hex')
// 按原始口令的 Unicode 码点长度筛选 6–128 字符，再转小写、计算 SHA-256、去重并排序。
// 这些摘要仅用于弱口令匹配，真实账号密码仍由业务服务使用 Argon2id 存储。
const hashes = [...new Set(source.split('\n').map(line => line.replace(/\r$/, '')).filter(word => [...word].length >= 6 && [...word].length <= 128).map(word => sha256(word.toLowerCase())))].sort()
if (!hashes.length) throw new Error('来源没有有效数据')
const folder = new URL('../server/data/security/', import.meta.url)
// 下载和基础校验完成后依次覆盖三个文件；写入不是原子事务，完成后需一起复核和提交。
await mkdir(folder, { recursive: true })
await writeFile(new URL('password-blocklist.json', folder), JSON.stringify(hashes) + '\n')
await writeFile(new URL('SecLists-LICENSE.txt', folder), license)
await writeFile(new URL('password-blocklist-source.json', folder), JSON.stringify({ repository: 'https://github.com/danielmiessler/SecLists', commit, path, sourceSha256: sha256(source), outputSha256: sha256(JSON.stringify(hashes) + '\n'), entries: hashes.length, transformation: '6–128 Unicode code points; lowercase; SHA-256; unique; sorted', license: 'MIT' }, null, 2) + '\n')
console.log('[PASSWORD DATA] 固定来源已导入，摘要数量', hashes.length)
