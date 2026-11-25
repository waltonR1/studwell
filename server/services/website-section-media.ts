// 复核区块媒体引用与发布要求，媒体记录由仓储读取。
import type {DatabaseExecutor} from '../db/transaction'
import type {SectionTemplate,SectionField} from '#shared/types/website/section-template'
import {websiteSectionUpdateSchema} from '#shared/schemas/admin/website-pages'
import {mediaRepository} from '../repositories/media'
import {ApiError} from '../core/errors'
import {imagePresentationSchema} from '#shared/schemas/image-presentation'
const fail=(message:string):never=>{throw new ApiError('INVALID_INPUT',[{path:'content',message}])}

export async function assertMediaReferences(db:DatabaseExecutor,refs:Array<{id:string;kind:'image'|'video'}>){
 const assets=new Map<string,Awaited<ReturnType<typeof mediaRepository.find>>>()
 for(const ref of refs){if(!assets.has(ref.id))assets.set(ref.id,await mediaRepository.find(db,BigInt(ref.id)));const asset=assets.get(ref.id);if(!asset||asset.kind!==ref.kind)fail('请选择媒体库中类型正确且仍然存在的媒体。')}
}

// Both draft writes and publication resolve assets through the media repository.
export async function assertSectionMedia(db:DatabaseExecutor,definition:Pick<SectionTemplate,'fields'|'mediaSlots'>,shared:unknown,localized:Record<string,unknown>){
 const slots=websiteSectionUpdateSchema.shape.shared.parse(shared).media
 if(slots.length!==definition.mediaSlots.length||new Set(slots.map(slot=>slot.key)).size!==slots.length||definition.mediaSlots.some(slot=>!slots.some(value=>value.key===slot.key&&value.name===slot.name)))fail('媒体字段与模板合同不一致。')
 const refs:Array<{id:string;kind:'image'|'video'}>=[]
 for(const slot of slots){const field=definition.mediaSlots.find(field=>field.key===slot.key)!;if(slot.presentation&&(field.kind==='video'||!field.imagePreset||!imagePresentationSchema(field.imagePreset).safeParse(slot.presentation).success))fail('图片展示设置不符合模板规则。');if(slot.mediaId)refs.push({id:slot.mediaId,kind:field.kind})}
 function visit(field:SectionField,value:unknown){
  if(field.optional&&value===undefined)return
  if(field.kind==='tree'){for(const [key,child] of Object.entries(field.fields))visit(child,(value as Record<string,unknown>)?.[key]);const children=(value as {children?:unknown})?.children;if(Array.isArray(children))for(const child of children)visit(field,child);return}
  if(field.kind==='group'){for(const [key,child] of Object.entries(field.fields??{}))visit(child,(value as Record<string,unknown>)?.[key]);return}
  if(field.kind==='list'){if(Array.isArray(value))for(const item of value)visit(field.item!,item);return}
  if(field.kind==='media'){const id=(value as {mediaId?:string|null})?.mediaId;if(id)refs.push({id,kind:field.mediaKind??'image'})}
 }
 for(const value of Object.values(localized))visit(definition.fields,value)
 await assertMediaReferences(db,refs)
}
