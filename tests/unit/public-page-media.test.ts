import imageRules from '../fixtures/media/image-rules'
import {expect, it} from 'vitest'
import {publicImage, publicVideo} from '../../app/utils/public/runtime/pageMedia'
import type {PublicMedia} from '../../shared/types/public/website'

const media: Record<string, PublicMedia> = {image: {id: 'image', src: '/uploads/image.png', kind: 'image', mime: 'image/png'}, video: {id: 'video', src: '/uploads/video.mp4', kind: 'video', mime: 'video/mp4'}}
it('媒体适配保留单语言或本地多语言 alt，取景属于引用而不是全局资产', () => {
  const presentation = {desktop: {x: 20, y: 70, zoom: 2}}
  expect(publicImage({mediaId: 'image', imagePreset:imageRules['cover'], presentation}, media, 'Current language')).toEqual({src: '/uploads/image.png', alt: 'Current language', imagePreset:imageRules['cover'], presentation})
  expect(publicImage({mediaId: 'image'}, media, {zh: '中文', en: 'English', fr: '', es: '', pt: ''})?.alt).toMatchObject({en: 'English'})
  expect(media.image).not.toHaveProperty('presentation')
  expect(publicImage({mediaId: null}, media)).toBeNull()
  expect(publicVideo({mediaId: 'video'}, media)).toBe('/uploads/video.mp4')
  expect(publicVideo({mediaId: null}, media)).toBeNull()
  expect(() => publicImage({mediaId: 'missing'}, media)).toThrow()
  expect(() => publicImage({mediaId: 'video'}, media)).toThrow()
  expect(() => publicVideo({mediaId: 'image'}, media)).toThrow()
})
