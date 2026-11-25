import imageRules from '../fixtures/reference/image-rules'
import {sectionContentSchema} from '../../shared/schemas/website/section-content'
import { expect,it } from 'vitest'
import { assignSharedImage } from '../../app/utils/admin/website/shared-image'
import { websiteTemplateCatalog } from '../fixtures/reference/template-catalog'

import {imagePresentationSchema} from '../../shared/schemas/image-presentation'
import type {SectionField} from '../../shared/types/website/section-template'
import type { ImageReference } from '../../shared/types/image-presentation'
import { templateDefinition } from '../fixtures/reference/template-catalog'
import { dragImageCrop,imageCropStyle,resolveImagePresentation } from '../../shared/utils/image-presentation'

it('所有模板图片字段及共享槽都有明确预设，视频文件不误接图片编辑',()=>{
 let fields=0,slots=0
 function visit(field:SectionField){
  if(field.kind==='media'&&field.mediaKind!=='video'){expect(field.imagePreset,field.label).toBeDefined();fields++}
  if(field.fields)Object.values(field.fields).forEach(visit)
  if(field.item)visit(field.item)
 }
 for(const template of websiteTemplateCatalog){visit(template.fields);for(const slot of template.mediaSlots)if(slot.kind==='image'){expect(slot.imagePreset,template.key+'.'+slot.key).toBeDefined();slots++}}
 expect(fields).toBeGreaterThan(0)
 expect(slots).toBeGreaterThan(0)
 expect(templateDefinition('hero.products')!.mediaSlots).toEqual([])
 expect(templateDefinition('export.shippingSection')!.mediaSlots).toContainEqual(expect.objectContaining({key:'pana-logistics',imagePreset:imageRules['contain']}))
})

it('共享槽接收完整图片配置，换图重置，取消副本不会污染原始配置',()=>{
 const slot:ImageReference={mediaId:'2026110214000000001'}
 const settings={mediaId:slot.mediaId,presentation:resolveImagePresentation(imageRules['photo'],{desktop:{x:40,y:60,zoom:1.2}})}
 assignSharedImage(slot,settings)
 settings.presentation.desktop.x=80
 expect(slot.presentation?.desktop?.x).toBe(40)
 assignSharedImage(slot,slot.mediaId)
 expect(slot.presentation?.desktop?.x).toBe(40)
 assignSharedImage(slot,'2026110214000000002')
 expect(slot.presentation).toBeUndefined()
 assignSharedImage(slot,null)
 expect(slot.mediaId).toBeNull()
})

it('拖动方向与图片移动一致，覆盖缩放后的可移动范围且边缘不会露白',()=>{
 const initial={x:50,y:50,zoom:1},frame={width:400,height:100},image={width:800,height:600}
 expect(dragImageCrop(initial,{x:40,y:-20},frame,image)).toEqual({x:50,y:60,zoom:1})
 expect(dragImageCrop(initial,{x:0,y:-2000},frame,image).y).toBe(100)
 expect(dragImageCrop(initial,{x:0,y:2000},frame,image).y).toBe(0)
 const zoomed=dragImageCrop({...initial,zoom:2},{x:40,y:-50},frame,image)
 expect(zoomed).toEqual({x:40,y:60,zoom:2})
 expect(imageCropStyle(zoomed)).toEqual({objectPosition:'40% 60%',transform:'scale(2)',transformOrigin:'40% 60%'})
 expect(dragImageCrop(initial,{x:1,y:1},{width:0,height:0},image)).toEqual(initial)
})

it('完整图片在填满取景框且未缩放时也可沿两个轴移动',()=>{
 const frame={width:240,height:64},center={x:50,y:50,zoom:1}
 const moved=dragImageCrop(center,{x:12,y:-100},frame,frame,'contain')
 expect(imageCropStyle(moved,'contain')).toMatchObject({translate:'5% -10%',objectPosition:'center',transform:'scale(1)'})
})

it('横幅默认居中且不透明，也可像封面一样单独设置手机取景和效果',()=>{
 const defaults=resolveImagePresentation(imageRules['column-banner'])
 expect(defaults.desktop).toEqual({x:50,y:50,zoom:1})
 expect(defaults.mobile).toEqual({x:50,y:50,zoom:1})
 expect(defaults.opacity).toBe(1)
 const presentation={desktop:{x:20,y:30,zoom:1.5},mobile:{x:80,y:60,zoom:2},opacity:.7,brightness:1.1}
 const banner=resolveImagePresentation(imageRules['column-banner'],presentation)
 expect(banner.desktop).toEqual(presentation.desktop)
 expect(banner.mobile).toEqual(presentation.mobile)
 const cover=resolveImagePresentation(imageRules['cover'],presentation)
 expect(cover.mobile).toEqual(presentation.mobile)
 expect(cover.opacity).toBe(presentation.opacity)
 expect(cover.brightness).toBe(presentation.brightness)
})

it('模板限制在服务端校验，禁止未开放的设备、效果及越界或非有限值',()=>{
 expect(imagePresentationSchema(imageRules['column-banner']).safeParse({desktop:{x:50,y:80,zoom:1.2},mobile:{x:30,y:40,zoom:1.5},opacity:1,brightness:.5}).success).toBe(true)
 expect(imagePresentationSchema(imageRules['cover']).safeParse({mobile:{x:20,y:30,zoom:2}}).success).toBe(true)
 for(const value of [{desktop:{x:-1,y:50,zoom:1}},{desktop:{x:50,y:50,zoom:.9}},{desktop:{x:50,y:50,zoom:3.1}},{desktop:{x:NaN,y:50,zoom:1}},{brightness:Infinity},{opacity:.19},{mobile:{x:50,y:101,zoom:1}},{unexpected:1}])expect(imagePresentationSchema(imageRules['column-banner']).safeParse(value).success,JSON.stringify(value)).toBe(false)
 expect(imagePresentationSchema(imageRules['cover']).safeParse({opacity:.5,brightness:1.5}).success).toBe(true)
 expect(imagePresentationSchema(imageRules['icon']).safeParse({opacity:.5}).success).toBe(false)
 expect(sectionContentSchema({kind:'media',label:'普通图片'}).safeParse({mediaId:null,presentation:{}}).success).toBe(false)
 expect(sectionContentSchema({kind:'media',label:'封面',imagePreset:imageRules['cover']}).safeParse({mediaId:'2026110214000000001',presentation:{desktop:{x:50,y:50,zoom:1}}}).success).toBe(true)
})
