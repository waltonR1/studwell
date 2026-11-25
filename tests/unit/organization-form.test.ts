import {sectionContentSchema} from '../../shared/schemas/website/section-content'
import {validateFixturePublication} from '../fixtures/website-publication'
import { fixturePageSettings } from '../fixtures/website-page-settings';
import { expect, it } from 'vitest';
import {sectionForms as configForms} from '../fixtures/template-forms'
const config=configForms['about.structureSection']!;
import { changeFormValue, initializeSectionForm, valueAt } from '../../app/utils/admin/website/section-forms';
import { beginCollectionEdit, collectionEditorRows, collectionEditorStructureError, collectionParentOptions, finishCollectionEdit, moveCollectionRow, removeCollectionRow, type CollectionEdit } from '../../app/utils/admin/website/collection-editor';
import { emptySectionContent } from '../../shared/utils/website/page-layouts';
import { templateDefinition } from '../fixtures/reference/template-catalog';
import { siteLocales } from '../../shared/schemas/admin/site-settings';
;
import type { CollectionField, ValueField } from '../../app/types/admin/website-section-forms';
import type { LocalizedSections } from '../../app/types/admin/website-section-editors';
import fixture from '../fixtures/website-content.json';
const definition = templateDefinition(config.key)!;
const field = config.groups[1]!.fields[0] as CollectionField;
const nameField = field.tree!.levels[0]!.fields[0] as ValueField;
const original = () => structuredClone(fixture.pages.flatMap(page => page.sections).find(section => section.templateKey === config.key)!.localized) as LocalizedSections;
const rows = (source: LocalizedSections, locale: typeof siteLocales[number] = 'zh') => collectionEditorRows(source, locale, field);
function name(edit: CollectionEdit, value: string) {
    const row = rows(edit.localized, edit.locale).find(row => row.key === edit.key)!;
    edit.localized = changeFormValue(edit.localized, edit.locale, nameField, row.base, value);
}
it('配置没有固定板块，现有五语言关系和内容无需迁移', () => {
    const source = original(), before = structuredClone(source);
    expect(field.fixedRows).toBeUndefined();
    expect(initializeSectionForm(source, config, definition)).toEqual(source);
    expect(rows(source).filter(row => row.depth === 1)).toHaveLength(3);
    expect(source).toEqual(before);
});
it('弹窗新增和编辑均隔离于原草稿，取消只丢弃临时副本', () => {
    const source = original(), before = structuredClone(source);
    const edit = beginCollectionEdit(source, 'zh', definition, field, 'studwell');
    name(edit, '新的主体名称');
    expect(source).toEqual(before);
    const added = beginCollectionEdit(source, 'zh', definition, field, null, 'studwell');
    name(added, '第四个板块');
    expect(source).toEqual(before);
    const saved = finishCollectionEdit(source, added, definition, field);
    expect(rows(saved).filter(row => row.depth === 1)).toHaveLength(4);
    expect(rows(saved, 'en').find(row => row.key === added.key)?.item.name).toBe('');
    expect(rows(finishCollectionEdit(source, edit, definition, field))[0]!.item.name).toBe('新的主体名称');
});
it('支持逐层新增到第四层之后，身份及关系跨语言同步而文字独立', () => {
    let next = original(), parent = 'cemsur-international';
    for (let depth = 0; depth < 5; depth++) {
        const edit = beginCollectionEdit(next, 'zh', definition, field, null, parent);
        name(edit, '新增节点 ' + depth);
        next = finishCollectionEdit(next, edit, definition, field);
        parent = edit.key;
    }
    expect(rows(next).find(row => row.key === parent)?.depth).toBe(7);
    expect(collectionEditorStructureError(next, field)).toBe('');
    for (const locale of siteLocales) {
        expect(rows(next, locale).find(row => row.key === parent)?.item.name).toBe(locale === 'zh' ? '新增节点 4' : '');
        expect(sectionContentSchema(definition.fields).safeParse(next[locale]).success).toBe(true);
    }
});
it('调整上级完整移动子树，保留所有后代、标识和翻译', () => {
    const source = original(), before = structuredClone(source);
    const edit = beginCollectionEdit(source, 'zh', definition, field, 'trade');
    edit.parent = 'sinobulk';
    const saved = finishCollectionEdit(source, edit, definition, field);
    for (const locale of siteLocales) {
        expect(rows(saved, locale).find(row => row.key === 'trade')?.parent).toBe('sinobulk');
        expect(rows(saved, locale).find(row => row.key === 'cemsur-international')?.depth).toBe(4);
        expect(rows(saved, locale).find(row => row.key === 'trade')?.item).toEqual(rows(source, locale).find(row => row.key === 'trade')?.item);
    }
    expect(source).toEqual(before);
});
it('上级选项排除自身与后代，直接提交循环关系也会拒绝', () => {
    const source = original(), edit = beginCollectionEdit(source, 'zh', definition, field, 'trade');
    const options = collectionParentOptions(edit, field).map(option => option.value);
    expect(options).not.toContain('trade');
    expect(options).not.toContain('cemsur-international');
    edit.parent = 'cemsur-international';
    expect(() => finishCollectionEdit(source, edit, definition, field)).toThrow('不能选择自身或下级');
});
it('节点排序及删除子树同步各语言，顶层内容可以清空后重新建立', () => {
    const source = original(), moved = moveCollectionRow(source, 'zh', definition, field, 'logistics', 'up');
    for (const locale of siteLocales)
        expect(rows(moved, locale).filter(row => row.depth === 1)[0]!.key).toBe('logistics');
    const removed = removeCollectionRow(moved, 'zh', definition, field, 'trade');
    for (const locale of siteLocales) {
        expect(rows(removed, locale).some(row => row.key === 'cemsur-international')).toBe(false);
        expect(rows(removed, locale).some(row => row.key === 'trade')).toBe(false);
    }
    const cleared = removeCollectionRow(removed, 'zh', definition, field, 'studwell');
    expect(rows(cleared)).toEqual([]);
    const edit = beginCollectionEdit(cleared, 'zh', definition, field, null);
    name(edit, '新主体');
    const saved = finishCollectionEdit(cleared, edit, definition, field);
    expect(rows(saved)[0]!.key).toBe(edit.key);
    expect(rows(saved)[0]!.item.name).toBe('新主体');
    expect(collectionEditorStructureError(saved, field)).toBe('');
});
it('空白内容直接新增顶层节点，不注入固定公司或业务板块', () => {
    const blank = Object.fromEntries(siteLocales.map(locale => [locale, emptySectionContent(definition.fields)])) as LocalizedSections;
    expect(rows(blank)).toEqual([]);
    const edit = beginCollectionEdit(blank, 'zh', definition, field, null);
    name(edit, '自定义主体');
    const saved = finishCollectionEdit(blank, edit, definition, field);
    expect(rows(saved)).toHaveLength(1);
    expect(rows(saved)[0]!.key).not.toBe('studwell');
});
it('语言关系不一致时只允许文字编辑，不按错误关系同步结构', () => {
    const source = original();
    (valueAt(source.fr, field.path + '.children') as unknown[]).reverse();
    const before = structuredClone(source);
    expect(collectionEditorStructureError(source, field)).toBeTruthy();
    expect(() => beginCollectionEdit(source, 'zh', definition, field, null, 'studwell')).toThrow('各语言的节点关系不一致');
    expect(() => removeCollectionRow(source, 'zh', definition, field, 'trade')).toThrow();
    const edit = beginCollectionEdit(source, 'zh', definition, field, 'trade');
    name(edit, '改名');
    expect(rows(finishCollectionEdit(source, edit, definition, field)).find(row => row.key === 'trade')?.item.name).toBe('改名');
    expect(source).toEqual(before);
});
it('弹窗期间原草稿变化时拒绝覆盖，空名称也不能确认', () => {
    const source = original(), edit = beginCollectionEdit(source, 'zh', definition, field, 'trade');
    name(edit, '');
    expect(rows(edit.localized).find(row => row.key === edit.key)?.item.name).toBe('');
    expect(() => finishCollectionEdit(source, edit, definition, field)).toThrow('请填写节点名称');
    name(edit, '新名称');
    const changed = structuredClone(source);
    (changed.zh as {
        copy: {
            title: string;
        };
    }).copy.title = '其他修改';
    expect(() => finishCollectionEdit(changed, edit, definition, field)).toThrow('页面内容已变化');
});
it('发布继续检查所有语言的节点名称，后代内容不被截断', async () => {
    const source = original();
    const snapshot = { settings: { ...fixturePageSettings(), sceneEnabled: false }, sections: [{ templateKey: config.key, anchorKey: 'about-structure', sortOrder: 0, visible: true, shared: { media: [] }, localized: source }] };
    await expect(validateFixturePublication('custom', snapshot)).resolves.toBeUndefined();
    const row = rows(source, 'fr').find(row => row.key === 'cemento-vietnam')!;
    snapshot.sections[0]!.localized = changeFormValue(source, 'fr', nameField, row.base, '');
    await expect(validateFixturePublication('custom', snapshot)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
});
it('沿用数据合同拒绝重复标识、额外字段和循环内容', () => {
    type Node = {
        id: string;
        name: string;
        children?: Node[];
    };
    const schema = sectionContentSchema(definition.fields), content = original().zh;
    const duplicate = structuredClone(content), root = valueAt(duplicate, field.path) as Node;
    root.children![0]!.id = root.id;
    expect(schema.safeParse(duplicate).success).toBe(false);
    const cyclic = structuredClone(content), cycle = valueAt(cyclic, field.path) as Node;
    cycle.children!.push(cycle);
    expect(schema.safeParse(cyclic).success).toBe(false);
    expect(() => rows({ ...original(), zh: cyclic })).toThrow();
    const extra = structuredClone(content);
    Object.assign(valueAt(extra, field.path) as Node, { arbitrary: 'unsupported' });
    expect(schema.safeParse(extra).success).toBe(false);
});
