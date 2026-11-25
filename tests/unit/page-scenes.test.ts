import { createCommentVNode, createTextVNode, Fragment, h, ref } from 'vue';
import { expect, it, vi } from 'vitest';
import { hasSceneContent, resolvePageScenes } from '../../app/utils/public/runtime/pageScenes';
import {useBrandEntrance} from '../../app/composables/public/runtime/useBrandEntrance';

it.each([
    {enabled:true},
    {enabled:false},
])('品牌开场遵循站点模板策略，完成后站内返回不再次遮挡：$enabled',({enabled})=>{
    const state=new Map<string,ReturnType<typeof ref<boolean>>>();
    vi.stubGlobal('useState',(key:string,initial:()=>boolean)=>{
        if(!state.has(key))state.set(key,ref(initial()));
        return state.get(key)!;
    });
    try{
        const entrance=useBrandEntrance(enabled);
        expect(entrance.pending.value).toBe(enabled);
        entrance.blocking.value=true;
        entrance.finish();
        expect(useBrandEntrance(enabled).pending.value).toBe(false);
        expect(entrance.blocking.value).toBe(false);
    }finally{vi.unstubAllGlobals()}
});
it('忽略注释掉的模块及 v-if=false 的占位节点', () => {
    expect(hasSceneContent([])).toBe(false);
    expect(hasSceneContent([createCommentVNode('HomeNewsSection')])).toBe(false);
    expect(hasSceneContent([createTextVNode(' \n '), createCommentVNode('v-if')])).toBe(false);
    expect(hasSceneContent([h(Fragment, [createCommentVNode('news')])])).toBe(false);
});
it('保留实际模块，包括 Fragment 中的模块', () => {
    expect(hasSceneContent([h({ render: () => h('section') })])).toBe(true);
    expect(hasSceneContent([h(Fragment, [createCommentVNode('news'), h('section')])])).toBe(true);
});
it('按发布顺序装配，同模板不同区块保持独立身份，不隐式补新闻', () => {
    const section = (id: string) => ({ id, templateKey: 'home.about', sortOrder: 0, anchorKey: `about-${id}` });
    const resolveComponent = ({ templateKey }: {
        templateKey: string;
    }) => templateKey === 'home.about' ? 'About' : undefined;
    const scenes = resolvePageScenes([section('2'), section('1')], resolveComponent);
    expect(scenes.map(scene => scene.name)).toEqual(['2', '1']);
    expect(scenes[0]).toMatchObject({ id: 'about-2', component: 'About' });
    expect(resolvePageScenes([], resolveComponent)).toEqual([]);
    expect(() => resolvePageScenes([{ ...section('3'), templateKey: 'unknown' }], resolveComponent)).toThrow();
    expect(() => resolvePageScenes([section('1'), section('1')], resolveComponent)).toThrow();
});
