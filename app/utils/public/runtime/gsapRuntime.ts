// 按需加载并缓存 GSAP，供页面场景和区块动画使用。
let runtime: Promise<{ gsap: typeof import('gsap').gsap }> | undefined
export function loadGsapRuntime() {
  runtime ??= import('gsap').then(core => ({ gsap: core.gsap }))
  return runtime
}
