// 切换搜索页语言时保留有效的查询词和筛选条件。
import {searchFilters} from '#shared/config/website/search'
type Route={path:string;query:Record<string,unknown>}
export function searchLocaleLocation(target:string,route:Route){
 if(!/\/search\/?$/.test(route.path))return target
 const [path]=target.split('?'),query=new URLSearchParams()
 const q=Array.isArray(route.query.q)?route.query.q[0]:route.query.q
 const type=Array.isArray(route.query.type)?route.query.type[0]:route.query.type
 if(typeof q==='string'&&q){query.set('q',q);if(typeof type==='string'&&type!=='all'&&searchFilters.includes(type as typeof searchFilters[number]))query.set('type',type)}
 return path+(query.size?'?'+query:'')
}
