import {expect,it} from 'vitest'
import {siteTargetLabel} from '../../app/utils/admin/site-settings/labels'
import {createSiteLink,emptySiteText} from '../../shared/utils/admin/site-settings'

it('目录未匹配时保留导航名称，不暴露内部路由标识或添加状态后缀',()=>{
 const link=createSiteLink('about',{module:'home',resourceId:'1'})
 link.target={type:'page',module:'about',resourceId:'1',value:''}
 link.label.zh='关于我们'
 expect(siteTargetLabel(link,[],'zh')).toBe('关于我们')
 expect(siteTargetLabel(link,[],'en')).toBe('链接目标')
 const label={...emptySiteText(),zh:'企业介绍'}
 expect(siteTargetLabel(link,[{key:'page:about:',resourceId:'1',path:'/about',target:link.target,label,}],'zh')).toBe('企业介绍')
})
