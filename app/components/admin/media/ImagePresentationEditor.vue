<script setup lang="ts">
import type {ImagePresentation,ImageRule,ImageCrop} from '#shared/types/image-presentation'
import {resolveImagePresentation,imageCropStyle,dragImageCrop} from '#shared/utils/image-presentation'
const props=defineProps<{src:string;preset:ImageRule;modelValue?:ImagePresentation;disabled?:boolean}>()
const emit=defineEmits<{'update:modelValue':[value:ImagePresentation]}>()
const rules=computed(()=>props.preset),device=ref<'desktop'|'mobile'>('desktop')
const fit=computed(()=>'fit'in rules.value?rules.value.fit:'cover')
const resolved=computed(()=>resolveImagePresentation(props.preset,props.modelValue))
const crop=computed(()=>resolved.value[device.value])
const frame=ref<HTMLElement|null>(null),previewImage=ref<HTMLImageElement|null>(null),natural=ref({width:0,height:0}),failed=ref(false),loaded=ref(false)
let drag:{x:number;y:number;crop:ImageCrop;width:number;height:number}|null=null
const dragging=ref(false),zoomId=useId(),opacityId=useId(),brightnessId=useId()
watch(()=>props.src,async()=>{loaded.value=false;failed.value=false;drag=null;dragging.value=false;await nextTick();cachedImage()})
watch(()=>props.preset,()=>{device.value='desktop';drag=null;dragging.value=false})
watch(()=>props.disabled,()=>{drag=null;dragging.value=false})
const previewStyle=computed(()=>({...imageCropStyle(crop.value,props.preset.fit==='contain'?'contain':'cover'),objectFit:fit.value,opacity:resolved.value.opacity,filter:`brightness(${resolved.value.brightness})`}))
function ready(image:HTMLImageElement){natural.value={width:image.naturalWidth,height:image.naturalHeight};loaded.value=true;failed.value=false}
function load(event:Event){ready(event.target as HTMLImageElement)}
function cachedImage(){if(previewImage.value?.complete&&previewImage.value.naturalWidth)ready(previewImage.value)}
onMounted(cachedImage)
function changeCrop(value:ImageCrop){
 if(props.disabled||!loaded.value)return
 emit('update:modelValue',{...resolved.value,[device.value]:value})
}
function start(event:PointerEvent){
 if(props.disabled||!loaded.value||(props.preset.maxZoom===1&&!props.preset.mobileEditable)||event.button!==0||!frame.value)return
 const rect=frame.value.getBoundingClientRect()
 drag={x:event.clientX,y:event.clientY,crop:{...crop.value},width:rect.width,height:rect.height};dragging.value=true
 frame.value.setPointerCapture(event.pointerId)
}
function move(event:PointerEvent){
 if(!drag||props.disabled)return
 changeCrop(dragImageCrop(drag.crop,{x:event.clientX-drag.x,y:event.clientY-drag.y},drag,natural.value,fit.value as 'cover'|'contain'))
}
function stop(){drag=null;dragging.value=false}
function keyboard(event:KeyboardEvent){
 if(props.disabled||!loaded.value||(props.preset.maxZoom===1&&!props.preset.mobileEditable)||!frame.value)return
 const directions:Record<string,{x:number;y:number}>={ArrowLeft:{x:-4,y:0},ArrowRight:{x:4,y:0},ArrowUp:{x:0,y:-4},ArrowDown:{x:0,y:4}}
 const delta=directions[event.key]
 if(!delta)return
 event.preventDefault()
 const rect=frame.value.getBoundingClientRect()
 changeCrop(dragImageCrop(crop.value,delta,rect,natural.value,fit.value as 'cover'|'contain'))
}
function effect(key:'opacity'|'brightness',event:Event){
 if(props.disabled||!loaded.value)return
 emit('update:modelValue',{...resolved.value,[key]:Number((event.target as HTMLInputElement).value)})
}
function reset(){
 if(props.disabled||!loaded.value)return
 emit('update:modelValue',resolveImagePresentation(props.preset))
}
</script>
<template>
 <div class="image-presentation-editor">
  <strong>{{ rules.label }}取景与效果</strong>
  <p class="admin-help">在取景框里拖动图片，使用缩放滑块调整大小；也可聚焦取景框后用方向键移动。保留原图，只保存展示设置。预览比例由模板规定，实际裁切随展示区域变化。</p>
  <div v-if="rules.mobileEditable" class="image-editor-devices" role="group" aria-label="调整的设备">
   <UButton type="button" class="admin-button" :aria-pressed="device==='desktop'" :disabled="disabled" @click="stop();device='desktop'">电脑端</UButton>
   <UButton type="button" class="admin-button" :aria-pressed="device==='mobile'" :disabled="disabled" @click="stop();device='mobile'">手机端</UButton>
  </div>
  <p v-else class="admin-help">取景和缩放仅作用于电脑端，手机端保持居中。透明度与亮度作用于整张图片。</p>
  <button ref="frame" type="button" class="image-editor-frame" :class="{'is-dragging':dragging}" :style="{aspectRatio:device==='desktop'?rules.desktopRatio:rules.mobileRatio}" :disabled="disabled||!loaded" aria-label="拖动图片调整取景" :aria-description="`${device==='desktop'?'电脑端':'手机端'}，缩放 ${Math.round(crop.zoom*100)}%`" @pointerdown="start" @pointermove="move" @pointerup="stop" @pointercancel="stop" @lostpointercapture="stop" @keydown="keyboard">
   <img ref="previewImage" :key="src" :src="src" :style="previewStyle" alt="图片裁切预览" draggable="false" @load="load" @error="failed=true;loaded=false"/>
   <span v-if="rules.overlay" class="image-editor-overlay" aria-hidden="true"/>
   <span v-if="rules.overlay" class="image-editor-copy" aria-hidden="true">栏目标题<br/><small>横幅介绍文字</small></span>
  </button>
  <p v-if="failed" class="admin-help" role="status">图片加载失败，暂时无法调整。</p>
  <label v-if="rules.maxZoom>1" :for="zoomId" class="image-editor-control"><span>缩放 {{ Math.round(crop.zoom*100) }}%</span><input :id="zoomId" type="range" min="1" :max="rules.maxZoom" step="0.01" :value="crop.zoom" :disabled="disabled||!loaded" @input="changeCrop({...crop,zoom:Number(($event.target as HTMLInputElement).value)})"/></label>
  <label v-if="rules.opacity.editable" :for="opacityId" class="image-editor-control"><span>图片显现程度 {{ Math.round(resolved.opacity*100) }}%</span><input :id="opacityId" type="range" :min="rules.opacity.min" :max="rules.opacity.max" step="0.01" :value="resolved.opacity" :disabled="disabled||!loaded" @input="effect('opacity',$event)"/></label>
  <label v-if="rules.brightness.editable" :for="brightnessId" class="image-editor-control"><span>亮度 {{ Math.round(resolved.brightness*100) }}%</span><input :id="brightnessId" type="range" :min="rules.brightness.min" :max="rules.brightness.max" step="0.01" :value="resolved.brightness" :disabled="disabled||!loaded" @input="effect('brightness',$event)"/></label>
  <UButton type="button" class="admin-button image-editor-reset" :disabled="disabled||!loaded" @click="reset">恢复模板默认</UButton>
 </div>
</template>
<style scoped>
.image-presentation-editor { display:grid; gap:14px; min-width:0; }
.image-editor-devices { display:flex; gap:8px; }
.image-editor-devices [aria-pressed=true] { background:#eaf1f8; border-color:#3269a5; }
.image-editor-frame { display:block; position:relative; width:100%; overflow:hidden; border:1px solid #ccd1d8; padding:0; background:#fff; cursor:grab; touch-action:none; }
.image-editor-frame.is-dragging { cursor:grabbing; }
.image-editor-frame:disabled { cursor:default; }
.image-editor-frame:focus-visible { outline:2px solid #3269a5; outline-offset:3px; }
.image-editor-frame img { display:block; position:absolute; inset:0; width:100%; height:100%; object-fit:cover; pointer-events:none; user-select:none; }
.image-editor-overlay { position:absolute; inset:0; background:linear-gradient(90deg,rgb(255 255 255 / .65),rgb(255 255 255 / .1)); pointer-events:none; }
.image-editor-copy { position:absolute; left:4%; top:30%; text-align:left; color:#202b33; font-size:clamp(16px,2vw,28px); font-weight:600; pointer-events:none; }
.image-editor-copy small { font-size:12px; font-weight:400; }
.image-editor-control { display:grid; grid-template-columns:160px minmax(0,1fr); align-items:center; gap:16px; font-size:14px; }
.image-editor-control input { width:100%; accent-color:#3269a5; }
.image-editor-reset { justify-self:start; }
@media(max-width:600px) { .image-editor-control { grid-template-columns:1fr; gap:8px; } }
</style>
