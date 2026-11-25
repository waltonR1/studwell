import imageRules from '../fixtures/media/image-rules'
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { computed, createSSRApp, defineComponent, h, inject, provide, ref, toValue } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { usePublicPage, usePublishedSection, resolveSectionMedia, providePublicSection } from '../../app/composables/public/runtime/usePublicPage';
import type { PublicPage, PublicPageStructure, PublicSection } from '../../shared/types/public/website';
const state = vi.hoisted(() => ({ snapshot: undefined as unknown }));
vi.mock('../../app/composables/public/runtime/usePageContent', () => ({ usePageContent: () => ({ snapshot: state.snapshot, ready: Promise.resolve() }) }));
const media: PublicPage['media'] = { image: { id: 'image', src: '/uploads/image.jpg', kind: 'image', mime: 'image/jpeg' }, video: { id: 'video', src: '/uploads/movie.mp4', kind: 'video', mime: 'video/mp4' } };
const section = (id: string, templateKey: string): PublicSection => ({ id, renderer: '', templateKey, sortOrder: 0, anchorKey: id, shared: { media: [] }, content: { copy: { title: id }, data: {} } });
function snapshot(sections: PublicSection[]) { return { page: { key: 'about', locale: 'en' as const, releaseId: '1', sections, media }, structure: { key: 'about', releaseId: '1', sceneEnabled: false, seo: { title: 'SEO', description: 'Description' }, sceneTransitionSeconds: null, sections } as PublicPageStructure }; }
beforeEach(() => { vi.stubGlobal('computed', computed); vi.stubGlobal('toValue', toValue); vi.stubGlobal('provide', provide); vi.stubGlobal('inject', inject); vi.stubGlobal('useRoute', () => ({ params: { slug: 'cement' } })); vi.stubGlobal('createError', (value: object) => Object.assign(new Error('Content error'), value)); });
afterEach(() => vi.unstubAllGlobals());

it('独立产品首屏从当前页面的已发布区块读取下一锚点', async () => {
    state.snapshot = ref(snapshot([
        section('hero', 'hero.product_category'),
        section('standards', 'product.cement_standards'),
        section('packaging', 'product.cement_packaging'),
    ]));
    const Hero = defineComponent({ setup() {
            const { nextSection } = usePublishedSection();
            return () => h('a', { href: '#' + nextSection.value?.anchorKey }, 'Browse');
        } });
    const html = await renderToString(createSSRApp({ setup() { usePublicPage('cement'); providePublicSection('hero'); return () => h(Hero); } }));
    expect(html).toBe('<a href="#standards">Browse</a>');
});
it('首页相同模板的多个 Section 按发布 ID 读取各自正文', async () => {
    state.snapshot = ref(snapshot([section('first', 'home.hero'), section('second', 'home.hero')]));
    const Content = defineComponent({ setup() { const content = usePublishedSection(); return () => h('p', content.t('title')); } });
    const Scope = defineComponent({ props: { id: { type: String, required: true } }, setup(props) { providePublicSection(() => props.id); return () => h(Content); } });
    const html = await renderToString(createSSRApp({ setup() { usePublicPage('home'); return () => h('main', [h(Scope, { id: 'first' }), h(Scope, { id: 'second' })]); } }));
    expect(html).toBe('<main><p>first</p><p>second</p></main>');
});

it('递归适配视频、图片、图库与空媒体引用，取景保留在具体引用', () => {
    const result = resolveSectionMedia({ video: { src: { mediaId: 'video' }, poster: { mediaId: 'image', imagePreset:imageRules['photo'] } }, images: [{ image: { mediaId: 'image', imagePreset:imageRules['contain'] } }], certificate: { src: { mediaId: 'image', imagePreset:imageRules['contain'] }, alt: 'Certificate' }, empty: { mediaId: null } }, media);
    expect(result).toEqual({ video: { src: '/uploads/movie.mp4', poster: { src: '/uploads/image.jpg', alt: '', imagePreset:imageRules['photo'] } }, images: [{ image: { src: '/uploads/image.jpg', alt: '', imagePreset:imageRules['contain'] } }], certificate: { src: '/uploads/image.jpg', alt: 'Certificate', imagePreset:imageRules['contain'] }, empty: null });
    expect(() => resolveSectionMedia({ mediaId: 'missing' }, media)).toThrow('Published image is unavailable');
});
