import {afterEach, expect, it, vi} from 'vitest'
import {computed, ref} from 'vue'
import {usePublicViewport} from '../../app/composables/public/runtime/usePublicViewport'

afterEach(() => vi.unstubAllGlobals())

it('异步入口在全站已判定为手机端后仍保持服务端首帧，挂载后再切换', () => {
  const mobile = ref(true)
  const mounts: Array<() => void> = []
  vi.stubGlobal('useState', () => mobile)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('onMounted', (callback: () => void) => mounts.push(callback))

  const first = usePublicViewport()
  expect(first.value).toBe(false)
  mounts[0]!()
  expect(first.value).toBe(true)

  // 后加载的区块不能用已挂载区块的手机状态去水合服务端桌面结构。
  const late = usePublicViewport()
  expect(late.value).toBe(false)
  expect(first.value).toBe(true)
  mounts[1]!()
  expect(late.value).toBe(true)

  mobile.value = false
  expect([first.value, late.value]).toEqual([false, false])
  mobile.value = true
  expect([first.value, late.value]).toEqual([true, true])
})
