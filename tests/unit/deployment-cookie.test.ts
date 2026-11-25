import {createServer} from 'node:http'
import {once} from 'node:events'
import {createApp, eventHandler, toNodeListener} from 'h3'
import {expect, it} from 'vitest'

import {SESSION_COOKIE, readSessionCookie, writeSessionCookie, clearSessionCookie} from '../../server/http/auth'

it('部署 Cookie 读写与退出使用同一名称，不读取其他站点的会话', async () => {
  const options = {origin:'http://localhost', secureCookie:false}
  const app = createApp().use(eventHandler(event => {
    if(event.path === '/write') writeSessionCookie(event, 'current-token', options, new Date(Date.now()+60000))
    if(event.path === '/clear') clearSessionCookie(event, options)
    return {token:readSessionCookie(event)??null}
  }))
  const server = createServer(toNodeListener(app))
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if(!address || typeof address === 'string') throw new Error('TEST_SERVER_ADDRESS_INVALID')
  const base = `http://127.0.0.1:${address.port}`
  try {
    expect(SESSION_COOKIE).toBe('studwell_admin_session')
    const foreign = await fetch(base, {headers:{cookie:'another_site_admin_session=foreign-token'}})
    expect(await foreign.json()).toEqual({token:null})
    const current = await fetch(base, {headers:{cookie:`another_site_admin_session=foreign-token; ${SESSION_COOKIE}=current-token`}})
    expect(await current.json()).toEqual({token:'current-token'})
    const written = await fetch(base+'/write')
    const cookie = written.headers.get('set-cookie')
    expect(cookie).toContain(`${SESSION_COOKIE}=current-token`)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Path=/')
    await written.text()
    const cleared = await fetch(base+'/clear')
    expect(cleared.headers.get('set-cookie')).toContain(`${SESSION_COOKIE}=`)
    expect(cleared.headers.get('set-cookie')).toContain('Max-Age=0')
    await cleared.text()
  } finally {
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()))
  }
})
