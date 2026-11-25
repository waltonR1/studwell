<script setup lang="ts">
import type {LinkTarget} from '#shared/schemas/website/link-target'
import {storeToRefs} from 'pinia'
import {useAdminNavigationTargetsStore} from '~/stores/admin/navigation-targets'
import TextField from '~/components/admin/common/TextField.vue'
import {ChevronDown} from 'lucide-vue-next'
import type {FormField,ValueField,CollectionField,BannerImagesField,SectionFormProps,ListAction} from '~/types/admin/website-section-forms'
import {valueAt,fieldPath,collectionRows,collectionStructureError,contentField} from '~/utils/admin/website/section-forms'
import LinkTargetSelect from '~/components/admin/website/shared/LinkTargetSelect.vue'
import CollectionTableField from './CollectionTableField.vue'
import BannerMediaField from './BannerMediaField.vue'
import ImageMediaField from '~/components/admin/media/ImageMediaField.vue'
import type {ImageReference,MediaSelection} from '#shared/types/image-presentation'
import type {LocalizedSections} from '~/types/admin/website-section-editors'
const props=withDefaults(defineProps<SectionFormProps&{fields:FormField[];basePath?:string;listTitle?:string;listDescription?:string}>(),{basePath:''})
const emit=defineEmits<{
 change:[field:ValueField,base:string,value:unknown]
 list:[field:CollectionField|ValueField,base:string,index:number,action:ListAction]
 media:[key:string,value:MediaSelection]
 banner:[field:BannerImagesField,index:number|null,value:string|null]
 replace:[value:LocalizedSections]
 validation:[path:string,message:string,inDialog?:boolean]
}>()
const pages=useAdminNavigationTargetsStore()
const {navigationTargets,navigationTargetsPending,navigationTargetsLoaded,navigationTargetsError}=storeToRefs(pages)
onMounted(()=>{
 if(props.fields.some(field=>field.kind==='link') && !navigationTargetsError.value)void pages.loadNavigationTargets()
})
const current=computed(()=>props.modelValue[props.locale])
const path=(field:ValueField)=>fieldPath(field,props.basePath)
const collectionPath=(field:CollectionField)=>fieldPath(field,props.basePath)
const read=(field:ValueField)=>valueAt(current.value,path(field))
const linkValue=(field:ValueField)=>read(field) as LinkTarget|null
const string=(field:ValueField)=>String(read(field)??'')
const maximum=(field:ValueField)=>contentField(props.definition,path(field))?.max??10000
const lines=(field:ValueField)=>{const value=read(field);return Array.isArray(value)?value:[]}
const limit=(field:CollectionField|ValueField)=>contentField(props.definition,field.kind==='collection'?collectionPath(field):path(field))?.max??100
const topicImage=(field:BannerImagesField,topic:Record<string,unknown>)=>valueAt(topic,field.imagePath+'.mediaId') as string|null
const topics=(field:BannerImagesField)=>{const value=valueAt(current.value,field.path);return Array.isArray(value)?value as Array<Record<string,unknown>>:[]}
function rows(field:CollectionField){
 const listPath=collectionPath(field),items=collectionRows(props.modelValue,props.locale,listPath)
 if(field.fixedRows)return field.fixedRows.map(row=>({index:items.findIndex(item=>valueAt(item,field.identity!)===row.key),title:row.label,fields:row.fields,key:row.key})).filter(row=>row.index>=0)
 return items.map((item,index)=>({index,title:String(field.titlePath?valueAt(item,field.titlePath)??'':'' )||`${field.itemLabel} ${index+1}`,fields:field.fields??[],key:String(field.identity?valueAt(item,field.identity)??index:index)}))
}
function pattern(field:ValueField){
 const token=`{${field.token??'count'}}`,value=string(field),index=value.indexOf(token)
 return index<0?{before:value,after:'',token}:{before:value.slice(0,index),after:value.slice(index+token.length),token}
}
function changePattern(field:ValueField,side:'before'|'after',value:string){const parts=pattern(field);parts[side]=value;emit('change',field,props.basePath,parts.before+parts.token+parts.after)}
function number(field:ValueField,value:string|number){emit('change',field,props.basePath,value===''?NaN:Number(value))}
</script>
<template>
 <div class="section-form-fields">
  <template v-for="field in fields" :key="field.kind==='slot'?field.key:field.kind==='bannerImages'?'banner':field.path">
   <CollectionTableField v-if="field.kind==='collection'&&field.presentation==='table'" :field="field" :base-path="basePath" :list-title="listTitle" :list-description="listDescription" :model-value="modelValue" :locale="locale" :definition="definition" :shared="shared" :config="config" :section-id="sectionId" :media-key="mediaKey" :banner-name="bannerName" :disabled="disabled" :readonly="readonly" @update:model-value="emit('replace',$event)" @update:media="(key,value)=>emit('media',key,value)" @validation="emit('validation',field.path,$event,true)">
    <template #editor="buffer">
     <SectionFormFields :fields="buffer.row.fields" :base-path="buffer.row.base" :model-value="buffer.edit.localized" :locale="buffer.edit.locale" :definition="definition" :shared="buffer.shared" :config="config" :section-id="sectionId" :media-key="mediaKey" :banner-name="bannerName" :disabled="disabled||readonly" :readonly="readonly" @change="buffer.change" @list="buffer.list" @media="buffer.media" @banner="buffer.banner" @replace="buffer.replace" @validation="buffer.validation"/>
    </template>
   </CollectionTableField>
   <div v-else-if="field.kind==='collection'" class="section-form-collection">
    <div class="section-form-collection-heading"><strong>{{ field.label }}</strong><span class="admin-help">{{ rows(field).length }} 项</span></div>
    <p v-if="field.help" class="admin-help">{{ field.help }}</p>
    <p v-if="!field.fixedRows" class="admin-help">增删和排序同步各语言；条目内的文字与图片按当前语言维护。</p>
    <AdminCommonFeedback v-if="collectionStructureError(modelValue,collectionPath(field),field.identity)" tone="warning">{{ collectionStructureError(modelValue,collectionPath(field),field.identity) }}</AdminCommonFeedback>
    <p v-if="!rows(field).length" class="admin-help">暂无{{ field.itemLabel }}</p>
    <div class="section-form-items">
    <details v-for="row in rows(field)" :key="row.key" class="section-form-item" :open="!!field.fixedRows||row.index===0">
     <summary><strong>{{ row.title }}</strong><span class="section-form-toggle"><span class="section-form-expand">展开</span><span class="section-form-collapse">收起</span><ChevronDown aria-hidden="true"/></span></summary>
     <div class="section-form-item-body">
      <AdminCommonRowActions v-if="!field.fixedRows&&!readonly">
       <UButton class="admin-button" :disabled="disabled||row.index===0||!!collectionStructureError(modelValue,collectionPath(field),field.identity)" @click="emit('list',field,basePath,row.index,'up')">上移</UButton>
       <UButton class="admin-button" :disabled="disabled||row.index===rows(field).length-1||!!collectionStructureError(modelValue,collectionPath(field),field.identity)" @click="emit('list',field,basePath,row.index,'down')">下移</UButton>
       <UButton class="admin-button" data-tone="danger" :disabled="disabled||!!collectionStructureError(modelValue,collectionPath(field),field.identity)" @click="emit('list',field,basePath,row.index,'remove')">移除{{ field.itemLabel }}</UButton>
      </AdminCommonRowActions>
      <SectionFormFields :fields="row.fields" :base-path="`${collectionPath(field)}.${row.index}`" :model-value="modelValue" :locale="locale" :definition="definition" :shared="shared" :config="config" :section-id="sectionId" :disabled="disabled" :readonly="readonly" @change="(field,base,value)=>emit('change',field,base,value)" @list="(field,base,index,action)=>emit('list',field,base,index,action)" @media="(key,value)=>emit('media',key,value)" @banner="(field,index,value)=>emit('banner',field,index,value)" @replace="emit('replace',$event)" @validation="(path,message,inDialog)=>emit('validation',path,message,inDialog)"/>
     </div>
    </details>
    </div>
    <UButton v-if="!field.fixedRows&&!readonly" class="admin-button section-form-add" :disabled="disabled||rows(field).length>=limit(field)||!!collectionStructureError(modelValue,collectionPath(field),field.identity)" @click="emit('list',field,basePath,-1,'add')">新增{{ field.itemLabel }}</UButton>
   </div>
   <div v-else-if="field.kind==='slot'" class="section-form-media">
    <ImageMediaField v-if="definition.mediaSlots.find(slot=>slot.key===field.key)?.kind==='image'" :field="`${sectionId}-shared-${field.key}`" :label="field.label" :model-value="shared.media.find(slot=>slot.key===field.key)??{mediaId:null}" :image-preset="definition.mediaSlots.find(slot=>slot.key===field.key)?.imagePreset" :disabled="disabled||readonly" @update:model-value="emit('media',field.key,$event)"/>
    <AdminMediaPicker v-else :field="`${sectionId}-shared-${field.key}`" :label="field.label" :model-value="shared.media.find(slot=>slot.key===field.key)?.mediaId??null" kind="video" :disabled="disabled||readonly" @update:model-value="emit('media',field.key,$event)"/>
    <p class="admin-help">此图片或视频各语言共用。</p>
   </div>
   <BannerMediaField v-else-if="field.kind==='bannerImages'&&field.videoPath" :field="field" :model-value="modelValue" :locale="locale" :definition="definition" :shared="shared" :config="config" :section-id="sectionId" :media-key="mediaKey" :banner-name="bannerName" :disabled="disabled" :readonly="readonly" @replace="emit('replace',$event)"/>
   <div v-else-if="field.kind==='bannerImages'" class="section-form-media">
    <p class="admin-help">{{ bannerName?bannerName+'栏目的配图，按当前语言维护。':'按当前语言维护横幅配图。' }}</p>
    <AdminMediaPicker v-for="(topic,index) in topics(field)" :key="String(valueAt(topic,field.identityPath))" :field="`${sectionId}-${locale}-banner-${index}`" :label="topics(field).length===1?field.label:`${field.label} ${index+1}`" :model-value="topicImage(field,topic)" kind="image" :disabled="disabled" @update:model-value="emit('banner',field,index,$event)"/>
    <AdminMediaPicker v-if="!topics.length" :field="`${sectionId}-${locale}-banner-new`" :label="field.label" :model-value="null" kind="image" :disabled="disabled" @update:model-value="emit('banner',field,null,$event)"/>
   </div>
   <ImageMediaField v-else-if="field.kind==='media'&&field.mediaKind!=='video'" :field="`${sectionId}-${locale}-${path(field)}`" :label="field.label" :model-value="(read(field) as ImageReference|undefined)??{mediaId:null}" :image-preset="contentField(definition,path(field))?.imagePreset" :disabled="disabled||readonly" @update:model-value="emit('change',field,basePath,$event)"/>
   <AdminMediaPicker v-else-if="field.kind==='media'" :field="`${sectionId}-${locale}-${path(field)}`" :label="field.label" :model-value="(read(field) as {mediaId?:string|null}|undefined)?.mediaId??null" kind="video" :disabled="disabled||readonly" @update:model-value="emit('change',field,basePath,{mediaId:$event})"/>
   <div v-else-if="field.kind==='lines'" class="section-form-lines">
    <strong>{{ field.label }}</strong>
    <div v-for="(line,index) in lines(field)" :key="index" class="section-form-line">
     <textarea :value="String(line)" class="admin-input" rows="2" :aria-label="`${field.label}第 ${index+1} 条`" :disabled="disabled" :maxlength="contentField(definition,path(field))?.item?.max??10000" @input="emit('change',{kind:'text',path:path(field)+'.'+index,label:field.label,absolute:true},'',($event.target as HTMLTextAreaElement).value)"/>
     <AdminCommonRowActions v-if="!readonly"><UButton class="admin-button" :disabled="disabled||index===0" @click="emit('list',field,basePath,index,'up')">上移</UButton><UButton class="admin-button" :disabled="disabled||index===lines(field).length-1" @click="emit('list',field,basePath,index,'down')">下移</UButton><UButton class="admin-button" data-tone="danger" :disabled="disabled" @click="emit('list',field,basePath,index,'remove')">移除</UButton></AdminCommonRowActions>
    </div>
    <UButton v-if="!readonly" class="admin-button section-form-add" :disabled="disabled||lines(field).length>=limit(field)" @click="emit('list',field,basePath,-1,'add')">添加{{ field.label }}</UButton>
   </div>
   <div v-else-if="field.kind==='pattern'" class="section-form-pattern"><strong>{{ field.label }}</strong><div class="section-form-pattern-fields">
    <TextField :model-value="pattern(field).before" :label="field.token==='year'?'年份前的文字':'数量前的文字'" :disabled="disabled" @update:model-value="changePattern(field,'before',$event)"/>
    <TextField :model-value="pattern(field).after" :label="field.token==='year'?'年份后的文字':'数量后的文字'" :disabled="disabled" @update:model-value="changePattern(field,'after',$event)"/>
    </div><p class="admin-help">显示示例：{{ pattern(field).before }}{{ field.sample??'3' }}{{ pattern(field).after }}</p>
   </div>
   <div v-else-if="field.kind==='link'" class="section-editor-field"><span>{{ field.label }}</span><div class="section-form-link">
    <LinkTargetSelect :key="locale" :model-value="linkValue(field)" :label="field.label" :locale="locale" :allow-empty="!contentField(definition,path(field))?.required" :targets="navigationTargets" :loading="navigationTargetsPending||(!navigationTargetsLoaded&&!navigationTargetsError)" :error="navigationTargetsError" @retry="pages.loadNavigationTargets(true)" :disabled="disabled||readonly" :max="maximum(field)" @update:model-value="emit('change',field,basePath,$event)"/>
    </div></div>
   <AdminCommonSwitchField v-else-if="field.kind==='boolean'" layout="row" :model-value="(read(field) ?? field.defaultChecked)===true" :label="field.label" :disabled="disabled||readonly" @update:model-value="emit('change',field,basePath,$event)"/>
   <label v-else-if="field.kind==='select'" class="section-editor-field">{{ field.label }}<AdminCommonSelectField :model-value="string(field)" :label="field.label" :items="field.options??[]" :disabled="disabled" :body-lock="false" @update:model-value="emit('change',field,basePath,$event)"/></label>
   <label v-else-if="field.kind==='number'" class="section-editor-field">{{ field.label }}<UInput type="number" :min="field.min" :max="field.max" :step="field.integer?1:'any'" :model-value="Number(read(field)??0)" :aria-label="field.label" :disabled="disabled" :ui="{base:'admin-input'}" @update:model-value="number(field,$event)"/></label>
   <TextField v-else :model-value="string(field)" :label="field.label" :multiline="field.kind==='textarea'" :rows="field.rows" :help="field.help" :max="maximum(field)" :disabled="disabled" @update:model-value="emit('change',field,basePath,$event)"/>
   <p v-if="'shared' in field&&field.shared" class="admin-help">此内容各语言共用。</p>
  </template>
 </div>
</template>
<style scoped>
.section-form-fields,.section-form-collection,.section-form-item-body,.section-form-lines,.section-form-media,.section-form-pattern { display: grid; gap: 22px; min-width: 0; }
.section-form-fields > .admin-help,.section-form-collection > .admin-help,.section-form-media > .admin-help,.section-form-pattern > .admin-help { margin: 0; }
.section-form-collection-heading { display: flex; align-items: center; gap: 12px; }
.section-form-items { display: grid; gap: 16px; min-width: 0; }
.section-form-item { border: 1px solid #e1e8f1; border-radius: 10px; overflow: clip; }
.section-form-item summary { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 18px; background: #f8fafc; cursor: pointer; }
.section-form-item summary span { flex-shrink: 0; color: #73859a; font-size: 12px; }
.section-form-item summary { list-style: none; }
.section-form-item summary::-webkit-details-marker { display: none; }
.section-form-item summary:hover { background: #eef3f9; }
.section-form-item[open] > summary { border-bottom: 1px solid #e1e8f1; }
.section-form-toggle { display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 5px; }
.section-form-toggle svg { width: 16px; height: 16px; transition: transform .15s; }
.section-form-collapse { display: none; }
.section-form-item[open] > summary .section-form-collapse { display: inline; }
.section-form-item[open] > summary .section-form-expand { display: none; }
.section-form-item[open] > summary svg { transform: rotate(180deg); }
.section-form-item summary:focus-visible { outline: 2px solid #3269a5; outline-offset: -2px; }
.section-form-item-body { padding: 20px; }
.section-form-add { justify-self: start; }
.section-form-line { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: start; gap: 12px; }
.section-form-line textarea { width: 100%; resize: vertical; }
.section-form-pattern-fields { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 20px; }
.section-form-link { display: grid; grid-template-columns: minmax(0,1fr); gap: 12px; width: 100%; min-width: 0; }
@media(max-width:720px){.section-form-line,.section-form-link,.section-form-pattern-fields { grid-template-columns: minmax(0,1fr); }.section-form-item-body { padding: 16px; }}
</style>
