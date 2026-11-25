// 当前语言的公开新闻摘要、正文和媒体投影，不暴露草稿及版本字段。
import type {ImagePresentation, ImageRule} from '../image-presentation'

export interface PublicNewsImage {
    src: string;
    alt: string;
    presentation?: ImagePresentation;
    imagePreset?: ImageRule
}

export type PublicNewsBlock = { type: 'heading' | 'paragraph'; text: string } | {
    type: 'image';
    image: PublicNewsImage;
    caption: string
}

export interface PublicNewsSummary {
    id: string;
    slug: string;
    category: { id: string; name: string };
    title: string;
    summary: string;
    publishedAt: string;
    coverImage: PublicNewsImage | null
}

export interface PublicNewsArticle extends PublicNewsSummary {
    viewCount: number | null;
    body: PublicNewsBlock[];
    seoTitle: string;
    seoDescription: string;
    source: { name: string; url: string } | null
}
