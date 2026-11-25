import imageRules from '../fixtures/media/image-rules'
import {defaultSiteLanguages} from '../../shared/config/site-languages'
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { computed, ref, toValue } from 'vue';
import { usePageContent } from '../../app/composables/public/runtime/usePageContent';
import type { ApiResponse } from '../../shared/types/api';
import type { PublicPage, PublicSiteSettings } from '../../shared/types/public/website';
const state = vi.hoisted(() => ({ bootstrap: undefined as unknown }));
vi.mock('../../app/composables/public/runtime/useSiteSettings', () => ({ useSiteSettings: () => state.bootstrap }));
const structure = (releaseId: string) => ({ key: 'home', releaseId, sceneEnabled: true, seo: { title: '', description: '' }, sceneTransitionSeconds: 0.5, sections: [] });
const page = (releaseId: string, locale: PublicPage['locale'] = 'en'): PublicPage => ({ key: 'home', locale, releaseId, sections: [], media: { '9': { id: '9', src: '/uploads/image.png', kind: 'image', mime: 'image/png' } } });
const language = ref('en');
let settings: ReturnType<typeof ref<PublicSiteSettings>>;
let data: ReturnType<typeof ref<ApiResponse<PublicPage>>>;
let error: ReturnType<typeof ref<Error | null>>;
let requestRefresh: ReturnType<typeof vi.fn>;
let bootstrapRefresh: ReturnType<typeof vi.fn>;
beforeEach(() => {
    language.value = 'en';
    settings = ref({ languages:defaultSiteLanguages,locale: 'en', basic: null, header: null, footer: null, pages: { home: structure('1') } });
    data = ref({ success: true, data: page('1'), requestId: 'request' });
    error = ref(null);
    requestRefresh = vi.fn(async () => { });
    bootstrapRefresh = vi.fn(async () => { });
    state.bootstrap = { settings, ready: Promise.resolve(), error: ref(null), refresh: bootstrapRefresh };
    vi.stubGlobal('useI18n', () => ({ locale: language }));
    vi.stubGlobal('computed', computed);
    vi.stubGlobal('toValue', toValue);
    vi.stubGlobal('createError', (value: object) => Object.assign(new Error('Page content error'), value));
    vi.stubGlobal('useFetch', vi.fn(() => {
        const values = { data, error, refresh: requestRefresh };
        return Object.assign(Promise.resolve(values), values);
    }));
});
afterEach(() => vi.unstubAllGlobals());
it('共享配置与正文同版才交付，图片可直接适配到展示组件', async () => {
    const content = usePageContent('home');
    await content.ready;
    expect(content.snapshot.value?.page.releaseId).toBe('1');
    expect(content.image({ mediaId: '9', imagePreset:imageRules['contain'] }, 'Published image')).toEqual({ src: '/uploads/image.png', alt: 'Published image', imagePreset:imageRules['contain'] });
    expect(requestRefresh).not.toHaveBeenCalled();
    expect(bootstrapRefresh).not.toHaveBeenCalled();
});
it('发布切换时最多自动重读一次两份数据，不拼接不同版本', async () => {
    settings.value!.pages.home = structure('2');
    requestRefresh.mockImplementation(async () => { data.value = { success: true, data: page('2'), requestId: 'request' }; });
    const content = usePageContent('home');
    expect(content.snapshot.value).toBeNull();
    await content.ready;
    expect(requestRefresh).toHaveBeenCalledTimes(1);
    expect(bootstrapRefresh).toHaveBeenCalledTimes(1);
    expect(content.snapshot.value?.page.releaseId).toBe('2');
});
it('持续不一致时给出可重试错误，不无限请求', async () => {
    settings.value!.pages.home = structure('2');
    const content = usePageContent('home');
    await expect(content.ready).rejects.toMatchObject({ statusCode: 503 });
    expect(requestRefresh).toHaveBeenCalledTimes(1);
    expect(content.snapshot.value).toBeNull();
    expect(() => content.image({ mediaId: '9' })).toThrow();
});
it('不存在页面的真实请求错误不会被空数据掩盖', async () => {
    error.value = Object.assign(new Error('Not found'), { statusCode: 404 });
    await expect(usePageContent('home').ready).rejects.toMatchObject({ statusCode: 404 });
    expect(bootstrapRefresh).not.toHaveBeenCalled();
});
it('切换语言时旧响应不再交付', async () => {
    const content = usePageContent('home');
    await content.ready;
    language.value = 'zh';
    expect(content.snapshot.value).toBeNull();
    data.value = { success: true, data: page('1', 'zh'), requestId: 'request' };
    expect(content.snapshot.value).toBeNull();
    settings.value = { ...settings.value!, locale: 'zh' };
    expect(content.snapshot.value?.page.locale).toBe('zh');
});
