// 构建期只记录可加载组件路径，供后台校验手工录入；不登记模板、不连接数据库。
import {globSync} from 'node:fs'
export function buildSectionRendererInventory(root=process.cwd()){
 return [...globSync('app/components/public/sections/**/*.vue',{cwd:root}),...globSync('app/components/admin/preview/templates/**/*.vue',{cwd:root})].map(path=>path.replaceAll('\\','/')).sort()
}
// Nuxt、离线服务及测试共用本模块的一次扫描结果。
export default buildSectionRendererInventory()
