import type {MediaSelection,ImageReference} from '#shared/types/image-presentation'
export function assignSharedImage(slot:ImageReference,value:MediaSelection){
 if(typeof value==='object'&&value){slot.mediaId=value.mediaId;slot.presentation=value.presentation?JSON.parse(JSON.stringify(value.presentation)):undefined}
 else {if(slot.mediaId!==value)delete slot.presentation;slot.mediaId=value}
}
