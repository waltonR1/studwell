import {describe,it,expect} from 'vitest'
import {readFile} from 'node:fs/promises'
import {inspectMediaFile} from '../../server/policies/media-file'
import {isMp4Video} from '../../server/policies/mp4'
import {createMediaApi,adminMediaFileUrl} from '../../app/api/admin/media'
describe('视频容器与媒体API边界',()=>{
 it('完整测试容器能识别为MP4视频，伪装及截断拒绝',async()=>{
  const bytes=await readFile('tests/fixtures/media/container.mp4')
  expect(inspectMediaFile(bytes,'overview.mp4','video/mp4')).toMatchObject({kind:'video',mime:'video/mp4',size:bytes.length})
  expect(isMp4Video(bytes.subarray(0,48))).toBe(false)
  expect(()=>inspectMediaFile(bytes,'overview.pdf','video/mp4')).toThrow()
  expect(()=>inspectMediaFile(Buffer.from('not video'),'fake.mp4','video/mp4')).toThrow()
 })
 it('媒体API定义上传端点，URL编码由API构造',async()=>{
  const calls:unknown[]=[]
  const api=createMediaApi({read:async<T>()=>null as T,mutate:async<T>()=>null as T,download:async()=>{throw Error('unused')},upload:async<T>(...args:unknown[])=>{calls.push(args);return null as T}})
  const file=new File(['test'],'a.mp4',{type:'video/mp4'});await api.upload(file)
  expect(calls).toEqual([['media',file,{filename:file.name},undefined]])
  expect(adminMediaFileUrl('a/b')).toBe('/api/admin/media/a%2Fb/file')
 })
})

import {parseMediaRange} from '../../server/http/media-range'
it('分段头支持前缀、尾段和开放范围，拒绝多段、溢出和非法值',()=>{
 expect(parseMediaRange('bytes=0-99')).toEqual({start:0,end:99})
 expect(parseMediaRange('bytes=100-')).toEqual({start:100,end:undefined})
 expect(parseMediaRange('bytes=-50')).toEqual({suffix:50})
 for(const header of ['bytes=','bytes=0-1,3-4','bytes=999999999999999999-','bytes=x-y'])expect(parseMediaRange(header)).toEqual({invalid:true})
})
