// 按传入的图片规则计算取景、效果和拖动坐标，不读取数据库或固定预设。
import type {ImageCrop, ImagePresentation, ImageRule} from '../types/image-presentation'

export function resolveImagePresentation(preset: ImageRule, value?: ImagePresentation) {
    return {
        desktop: value?.desktop ?? {x: 50, y: 50, zoom: 1},
        mobile: preset.mobileEditable ? (value?.mobile ?? {x: 50, y: 50, zoom: 1}) : {x: 50, y: 50, zoom: 1},
        opacity: preset.opacity.editable ? (value?.opacity ?? preset.opacity.value) : preset.opacity.value,
        brightness: preset.brightness.editable ? (value?.brightness ?? preset.brightness.value) : preset.brightness.value
    }
}

export function containImageOffset(crop: ImageCrop) {
    return `${(crop.x - 50) / 5}% ${(crop.y - 50) / 5}%`
}

export function imageCropStyle(crop: ImageCrop, fit: 'cover' | 'contain' = 'cover') {
    if (fit === 'contain') return {
        objectPosition: 'center',
        transform: `scale(${crop.zoom})`,
        transformOrigin: 'center',
        translate: containImageOffset(crop)
    }
    return {
        objectPosition: `${crop.x}% ${crop.y}%`,
        transform: `scale(${crop.zoom})`,
        transformOrigin: `${crop.x}% ${crop.y}%`
    }
}

// Map dragging the image (rather than a point) to object-position, including zoom.
export function dragImageCrop(crop: ImageCrop, delta: { x: number; y: number }, frame: {
    width: number;
    height: number
}, image: { width: number; height: number }, fit: 'cover' | 'contain' = 'cover'): ImageCrop {
    if (frame.width <= 0 || frame.height <= 0 || image.width <= 0 || image.height <= 0) return {...crop}
    const clamp = (value: number) => Math.round(Math.max(0, Math.min(100, value)) * 100) / 100
    if (fit === 'contain') return {
        ...crop,
        x: clamp(crop.x + delta.x / frame.width * 500),
        y: clamp(crop.y + delta.y / frame.height * 500)
    }
    const scale = Math.max(frame.width / image.width, frame.height / image.height) * crop.zoom
    const overflowX = image.width * scale - frame.width, overflowY = image.height * scale - frame.height
    const coordinate = (value: number, movement: number, overflow: number) => overflow > 0.01 ? clamp(value - movement / overflow * 100) : value
    return {...crop, x: coordinate(crop.x, delta.x, overflowX), y: coordinate(crop.y, delta.y, overflowY)}
}
