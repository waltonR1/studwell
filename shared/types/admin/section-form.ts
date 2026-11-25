// 数据库模板修订中的声明式编辑布局；不包含可执行代码。
export interface FormFieldBase {
    label: string;
    help?: string
}

export interface ValueField extends FormFieldBase {
    key?: string
    kind: 'text' | 'textarea' | 'number' | 'media' | 'link' | 'select' | 'pattern' | 'lines' | 'boolean'
    path: string
    absolute?: boolean
    shared?: boolean
    optional?: boolean
    defaultChecked?: boolean
    mediaKind?: 'image' | 'video'
    options?: Array<{ value: string; label: string }>
    token?: string
    sample?: string
    min?: number
    max?: number
    integer?: boolean
    rows?: number
    deriveTelephone?: boolean
    exclusive?: { value: string; replacement: string }
}

export interface CollectionField extends FormFieldBase {
    absolute?: boolean
    nameLabel?: string
    presentation?: 'table'
    columns?: Array<{ label: string; field: string; editable?: boolean }>
    tree?: {
        roots: 'single' | 'multiple'
        childrenField: string
        allowReparent: boolean
        maxDepth?: number
        defaultExpanded?: boolean
        showParent?: boolean
        showLevelLabels?: boolean
        levels: Array<{
            identity?: string
            itemLabel: string
            titlePath?: string
            titleFallback?: string
            fields: FormField[]
        }>
    }
    kind: 'collection'
    path: string
    identity?: string
    itemLabel: string
    titlePath?: string
    fields?: FormField[]
    fixedRows?: Array<{ key: string; label: string; fields: FormField[]; bindings?: Record<string, unknown> }>
    defaults?: Record<string, unknown>
}

export interface SlotField extends FormFieldBase {
    kind: 'slot';
    key: string
}

export interface BannerImagesField extends FormFieldBase {
    kind: 'bannerImages';
    path: string;
    identityPath: string;
    imagePath: string;
    defaults: Record<string, unknown>;
    videoPath?: string
}

export type FormField = ValueField | CollectionField | SlotField | BannerImagesField

export interface SectionFormDefinition {
    key: string;
    readOnlyPaths?: string[];
    groups: Array<{ title: string; help?: string; fields: FormField[] }>
}
