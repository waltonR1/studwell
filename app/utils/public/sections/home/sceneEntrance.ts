// 只有场景切换完成才播放内部入场，不根据滚动位置或可见比例提前播放。
import type { gsap as Gsap } from 'gsap'
type Timeline = ReturnType<typeof Gsap.timeline>

export function playOnSceneEnter(target: HTMLElement, timeline: Timeline, seen: WeakSet<HTMLElement>, related: readonly HTMLElement[] = []) {
  const scene = target.closest<HTMLElement>('[data-page-scene]')
  if (!scene) { timeline.progress(1).pause(); return () => timeline.kill() }
  let started = false
  const remember = () => { seen.add(target); related.forEach(element => seen.add(element)) }
  const finish = () => { started = true; remember(); timeline.progress(1).pause() }
  const enter = () => {
    if (started) return
    started = true
    remember()
    timeline.restart()
  }
  const leave = () => { if (started) finish(); started = false }
  const prepare = () => { timeline.progress(0).pause(); started = false }
  const alreadySeen = seen.has(target) || related.some(element => seen.has(element))
  if (alreadySeen) { finish(); started = scene.dataset.sceneState === 'active' }
  scene.addEventListener('page-scene-prepare', prepare)
  scene.addEventListener('page-scene-enter', enter)
  scene.addEventListener('page-scene-leave', leave)
  // 动画资源晚于切换完成加载时，立即开始入场，不丢失事件。
  if (scene.dataset.sceneState === 'active') enter()
  return () => {
    scene.removeEventListener('page-scene-prepare', prepare)
    scene.removeEventListener('page-scene-enter', enter)
    scene.removeEventListener('page-scene-leave', leave)
    timeline.kill()
  }
}
