// 图片展示规则来自数据库模板修订或模块图片规则；算法只消费规则值。
export interface ImageCrop {
    x: number;
    y: number;
    zoom: number
}

export interface ImagePresentation {
    desktop?: ImageCrop;
    mobile?: ImageCrop;
    opacity?: number;
    brightness?: number
}

export interface ImageEffectRule {
    value: number;
    min: number;
    max: number;
    editable: boolean
}

export interface ImageRule {
    label: string;
    fit: 'cover' | 'contain';
    desktopRatio: number;
    mobileRatio: number;
    mobileEditable: boolean;
    maxZoom: number;
    opacity: ImageEffectRule;
    brightness: ImageEffectRule;
    overlay: boolean
}

export interface ImageReference {
    mediaId: string | null;
    presentation?: ImagePresentation
}

export type MediaSelection = string | null | ImageReference
