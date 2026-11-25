import {describe, expect, it} from 'vitest'
import {siteSettingsSchema, siteSettingsUpdateSchema} from '../../shared/schemas/admin/site-settings'
import {createSiteSettings,createSiteLink,emptySiteText} from '../../shared/utils/admin/site-settings'

describe('公共维护分区合同', () => {
    it('每次只提交一个维护分区，拒绝整站覆盖和越界版本', () => {
        const content = createSiteSettings()
        expect(siteSettingsUpdateSchema.safeParse({section: 'basic', version: 0, content: content.basic}).success).toBe(true)
        for (const input of [{version: 0, content}, {section: 'basic', version: 1, content}, {section: 'other', version: 1, content: {}}, {section: 'basic', version: 4294967295, content: content.basic}]) expect(siteSettingsUpdateSchema.safeParse(input).success).toBe(false)
    })
    it('五语言文字独立保存，拒绝额外语言、非法媒体和邮箱', () => {
        const data = createSiteSettings()
        data.footer.description.fr = 'Nom du site'
        expect(siteSettingsSchema.parse(data).footer.description.fr).toBe('Nom du site')
        expect(siteSettingsSchema.safeParse({...data, basic: {...data.basic, logoId: '0'}}).success).toBe(false)
        expect(siteSettingsSchema.safeParse({...data, footer: {...data.footer, description: {...data.footer.description, de: 'x'}}}).success).toBe(false)
        expect(siteSettingsSchema.safeParse({...data, footer: {...data.footer, contacts:[{id:'email',kind:'email',label:emptySiteText(),value:{...emptySiteText(),zh:'invalid'},visible:true}]}}).success).toBe(false)
    })
    it('电话和地址按显示语言独立保存，不使用热线管理或回退', () => {
        const data = createSiteSettings()
        data.footer.contacts=[{id:'phone',kind:'phone',label:emptySiteText(),value:{...emptySiteText(),zh:'+86 123 4567'},visible:true},{id:'address',kind:'text',label:emptySiteText(),value:{...emptySiteText(),zh:'中文地址'},visible:true}]
        expect(siteSettingsSchema.parse(data).footer.contacts[0]?.value.en).toBe('')
        expect(siteSettingsSchema.safeParse({...data, contact: {}}).success).toBe(false)
        expect(siteSettingsUpdateSchema.safeParse({section: 'contact', version: 1, content: {}}).success).toBe(false)
    })
    it('导航层级独立于链接目标，主题和分类页面均允许手动子项', () => {
        const data = createSiteSettings(), link = createSiteLink('products',{module:'home',resourceId:'1'})
        link.target.module = 'products'
        data.header.items = [{...link, children: []}]
        expect(siteSettingsSchema.safeParse(data).success).toBe(true)
        data.header.items[0]!.children.push(createSiteLink('cement',{module:'home',resourceId:'1'}))
        expect(siteSettingsSchema.safeParse(data).success).toBe(true)
        data.header.items[0]!.target = {module:'about',resourceId:'1',type:'page',value:''}
        expect(siteSettingsSchema.safeParse(data).success).toBe(true)
    })
    it('顺序和显示状态被保留，拒绝重复导航编码和任意路径', () => {
        const data = createSiteSettings()
        data.header.items = ['one', 'two'].map(id => ({...createSiteLink(id,{module:'home',resourceId:'1'}), children: []}))
        data.header.items[0]!.visible = false
        expect(siteSettingsSchema.parse(data).header.items.map(item => item.id)).toEqual(['one', 'two'])
        data.header.items[1]!.id = 'one'
        expect(siteSettingsSchema.safeParse(data).success).toBe(false)
        data.header.items[1]!.id = 'two'
        data.header.items[0]!.target = {module:'../admin',resourceId:'1',type:'page',value:''}
        expect(siteSettingsSchema.safeParse(data).success).toBe(false)
    })
})

it('新建链接没有隐含首页身份，选定目标后才成为有效站内链接',()=>{
 const draft=createSiteLink('new')
 expect(draft.target).toEqual({module:'',resourceId:'',type:'page',value:''})
 expect(siteSettingsSchema.shape.header.safeParse({tagline:emptySiteText(),items:[{...draft,children:[]}]}).success).toBe(false)
 const selected=createSiteLink('selected',{module:'services',resourceId:'123'})
 expect(selected.target.module).toBe('services')
 expect(siteSettingsSchema.shape.header.safeParse({tagline:emptySiteText(),items:[{...selected,children:[]}]}).success).toBe(true)
})
