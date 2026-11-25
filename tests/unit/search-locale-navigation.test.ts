import {expect,it} from 'vitest'
import {searchLocaleLocation} from '../../app/utils/public/runtime/search/localeNavigation'
it('搜索模板切换语言保留查询和有效类型，重置页码',()=>{
 expect(searchLocaleLocation('/fr/search?q=cement&page=3',{path:'/en/search',query:{q:'cement',type:'news',page:'3'}})).toBe('/fr/search?q=cement&type=news')
 expect(searchLocaleLocation('/fr/search?q=cement',{path:'/en/search',query:{q:'cement',type:'invalid'}})).toBe('/fr/search?q=cement')
 expect(searchLocaleLocation('/fr/search',{path:'/en/search',query:{q:'cement',type:'products'}})).toBe('/fr/search?q=cement')
})
it('其他页面的语言切换由路由框架原样处理',()=>{
 expect(searchLocaleLocation('/fr/company?tab=history#team',{path:'/en/company',query:{tab:'history'}})).toBe('/fr/company?tab=history#team')
})
