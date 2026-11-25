// 密码策略与本机 Argon2id 原生实现回归，不使用真实 Root 凭据。
import { describe, expect, it } from 'vitest'
import { hashPassword, passwordNeedsRehash, validatePassword, verifyPassword } from '../../server/services/accounts/password'
import { normalizeUsername } from '../../server/services/accounts'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

describe('账号密码基础', () => {
  it('用户名规范化且不接受模糊 Unicode 或非法字符', () => {
    expect(normalizeUsername(' Alice_123 ')).toBe('alice_123')
    expect(() => normalizeUsername('Ａlice')).toThrow()
    expect(() => normalizeUsername('a b')).toThrow()
  })
  it('按 Unicode 字符计数，允许长口令，不截断', () => {
    expect(() => validatePassword('星'.repeat(6))).not.toThrow()
    expect(() => validatePassword('星'.repeat(5), false)).toThrow()
    expect(() => validatePassword('星'.repeat(129))).toThrow()
    expect(() => validatePassword('PASSWORDPASSWORD', true)).toThrow()
    expect(() => validatePassword('123456', true)).toThrow()
  })
  it('关闭时手写和离线名单均不检查；长度限制仍生效', async () => {
    expect(() => validatePassword('PASSWORDPASSWORD', false)).not.toThrow()
    expect(() => validatePassword('qwertyuiopasdfghjkl', false)).not.toThrow()
    expect(() => validatePassword('123456', false)).not.toThrow()
    expect(() => validatePassword('short', false)).toThrow()
    expect(await verifyPassword(await hashPassword('123456', false), '123456')).toBe(true)
  })
  it('随机盐、正确/错误密码验证以及参数升级判断', async () => {
    const password = 'Test-only Stellar Passage 849!'
    const first = await hashPassword(password)
    const second = await hashPassword(password)
    expect(first).toMatch(/^\$argon2id\$/)
    expect(first).not.toBe(second)
    expect(first).not.toContain(password)
    expect(await verifyPassword(first, password)).toBe(true)
    expect(await verifyPassword(first, password + '!')).toBe(false)
    expect(await verifyPassword('invalid', password)).toBe(false)
    expect(passwordNeedsRehash(first)).toBe(false)
    expect(passwordNeedsRehash('invalid')).toBe(true)
  })
  it('固定来源的离线拒绝数据生效，摘要与元数据一致', async () => {
    expect(() => validatePassword('qwertyuiopasdfghjkl', true)).toThrow()
    const data = await readFile(new URL('../../server/data/security/password-blocklist.json', import.meta.url))
    const source = JSON.parse(await readFile(new URL('../../server/data/security/password-blocklist-source.json', import.meta.url), 'utf8'))
    expect(createHash('sha256').update(data).digest('hex')).toBe(source.outputSha256)
    expect(JSON.parse(data.toString())).toHaveLength(source.entries)
  })
})
