// 多个面板共用正文滚动锁，最后一个关闭后恢复原样式。
import { watch, onBeforeUnmount, type Ref } from 'vue'
// 锁所有者集合：不同面板使用不同标识，最后一个关闭后才允许正文滚动。
const owners = new Set<symbol>()
let previousOverflow = ''
// 为当前面板登记独立锁所有者，避免多个面板互相提前解除滚动锁。
export function useBodyScrollLock(locked: Ref<boolean>) {
  const owner = Symbol('scroll-lock')
// 释放当前面板的锁；仅在最后一个所有者退出时恢复正文原来的 overflow。
  function release() {
    if (!import.meta.client || !owners.delete(owner)) return
    if (!owners.size) document.body.style.overflow = previousOverflow
  }
// 同步面板状态与锁所有权，服务端不访问 document。
  watch(locked, value => {
    if (!import.meta.client) return
    if (!value) { release(); return }
    if (owners.has(owner)) return
    if (!owners.size) previousOverflow = document.body.style.overflow
    owners.add(owner)
    document.body.style.overflow = 'hidden'
  }, { flush: 'sync' })
  onBeforeUnmount(release)
}
