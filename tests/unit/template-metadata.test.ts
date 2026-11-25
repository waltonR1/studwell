import {expect,it} from 'vitest'
import {sectionTemplateRevisionSchema} from '../../shared/schemas/admin/section-template'
import {imageRuleSchema,imagePresentationSchema} from '../../shared/schemas/image-presentation'
import {sectionFormSchema} from '../../shared/schemas/admin/section-form'
import {websiteTemplateCatalog} from '../fixtures/reference/template-catalog'
import {resolveSectionForm} from '../../app/utils/admin/website/section-form-definition'
it('所有初始模板均携带合法数据库编辑布局和完整图片规则',()=>{
 for(const definition of websiteTemplateCatalog)expect(sectionTemplateRevisionSchema.safeParse(definition).success,definition.key).toBe(true)
})
it('全新模板直接使用数据库编辑布局，不需要前端文件登记',()=>{
 const template={...structuredClone(websiteTemplateCatalog[0]!),key:'custom.database-only',fields:{kind:'group' as const,label:'内容',fields:{heading:{kind:'text' as const,label:'标题'}}},mediaSlots:[],editor:{key:'custom.database-only',groups:[{title:'数据库布局',fields:[{kind:'textarea' as const,path:'heading',label:'数据库标签',rows:6}]}]}}
 expect(sectionTemplateRevisionSchema.safeParse(template).success).toBe(true)
 expect(resolveSectionForm(template)).toEqual(template.editor)
})
it('拒绝旧图片代称、缺失编辑合同和错误归属，不保留兼容读取',()=>{
 expect(imageRuleSchema.safeParse('photo').success).toBe(false)
 const template=structuredClone(websiteTemplateCatalog[0]!)
 const {editor:_editor,...missing}=template
 expect(sectionTemplateRevisionSchema.safeParse(missing).success).toBe(false)
 expect(sectionTemplateRevisionSchema.safeParse({...template,editor:{key:'other',groups:[]}}).success).toBe(false)
 expect(sectionFormSchema.safeParse({key:'custom',groups:[{title:'非法路径',fields:[{kind:'text',path:'__proto__.value',label:'字段'}]}]}).success).toBe(false)
})
it('图片校验随数据库数值规则变化，校验器不依赖固定预设',()=>{
 const rule=imageRuleSchema.parse({label:'自定义图片',fit:'cover',desktopRatio:2,mobileRatio:1,mobileEditable:false,maxZoom:1.5,opacity:{value:1,min:1,max:1,editable:false},brightness:{value:1,min:.8,max:1.2,editable:true},overlay:false})
 expect(imagePresentationSchema(rule).safeParse({desktop:{x:30,y:50,zoom:1.4},brightness:1.1}).success).toBe(true)
 expect(imagePresentationSchema(rule).safeParse({desktop:{x:30,y:50,zoom:2}}).success).toBe(false)
 expect(imagePresentationSchema(rule).safeParse({mobile:{x:30,y:50,zoom:1}}).success).toBe(false)
 expect(imagePresentationSchema(rule).safeParse({opacity:.9}).success).toBe(false)
})

it('目录分类独立于预览页面，并覆盖全部初始模板',()=>{
 const categories = new Map(websiteTemplateCatalog.map(template=>[template.key,template.category]))
 expect(websiteTemplateCatalog.every(template=>!!template.category)).toBe(true)
 expect(categories.get('content.page-entry')).toBe('页面行为')
 expect(categories.get('content.page-nav')).toBe('通用')
 expect(categories.get('contact.cta')).toBe('通用')
 expect(categories.get('hero.about')).toBe('企业介绍')
 expect(categories.get('news.article')).toBe('新闻')
 expect(sectionTemplateRevisionSchema.safeParse({...websiteTemplateCatalog[0]!,category:'自定义分类'}).success).toBe(true)
})
