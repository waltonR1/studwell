// 品牌开场状态：入口决定是否启用，站内路由沿用完成状态，不重复遮挡页面。
export function useBrandEntrance(enabled=false) {
  const pending = useState('brand-entrance', () => enabled)
  // 客户端才开启交互约束；无 JavaScript 时正文仍可访问。
  const blocking = useState('brand-blocking', () => false)
  const finish = () => { blocking.value = false; pending.value = false }
  return { pending, blocking, finish }
}
