import {resolveSectionForm} from '../../app/utils/admin/website/section-form-definition'
import {sectionContentSchema} from '../../shared/schemas/website/section-content'
import {validateFixturePublication} from '../fixtures/website-publication'
import { fixturePageSettings } from '../fixtures/website-page-settings';
import { initializeStatistics, setStatistic, setStatisticYear, type StatisticsContent } from '../fixtures/statistics-editor';
import {sectionForms as statisticsFormForms} from '../fixtures/template-forms'
const statisticsForm=statisticsFormForms['home.statistics']!;
import { editLocale } from '../../app/utils/admin/website/section-editors';
import { expect, it } from 'vitest';
import { sectionForms } from '../fixtures/template-forms';
import { websiteTemplateCatalog } from '../fixtures/reference/template-catalog';
import { templateDefinition } from '../fixtures/reference/template-catalog';
import { emptySectionContent } from '../../shared/utils/website/page-layouts';
;
import { siteLocales } from '../../shared/schemas/admin/site-settings';
import { contentField, fieldPath, initializeSectionForm, changeFormValue, valueAt, sectionFormLinkErrors } from '../../app/utils/admin/website/section-forms';
import { beginCollectionEdit, collectionEditorRows, collectionParentOptions, finishCollectionEdit, moveCollectionRow, removeCollectionRow } from '../../app/utils/admin/website/collection-editor';
import type { CollectionField, FormField, ValueField } from '../../app/types/admin/website-section-forms';
import type { LocalizedSections } from '../../app/types/admin/website-section-editors';
import fixture from '../fixtures/website-content.json';
function blank(key: string) { return Object.fromEntries(siteLocales.map(locale => [locale, emptySectionContent(templateDefinition(key)!.fields)])) as LocalizedSections; }
it('只有出口三类正文保留可编辑区块标识，初始化不再由标题或模板名代填', () => {
    const retained = ['export.overviewSection', 'export.shippingSection', 'export.certificatesSection'];
    expect(websiteTemplateCatalog.filter(definition => contentField(definition, 'copy.label')).map(definition => definition.key).sort()).toEqual([...retained].sort());
    for (const key of retained) {
        const definition = templateDefinition(key)!, config = sectionForms[key]!;
        const field = config.groups.flatMap(group => group.fields).find(field => 'path' in field && field.path === 'copy.label') as ValueField;
        expect(field?.kind).toBe('text');
        const localized = blank(key);
        for (const locale of siteLocales) {
            const copy = valueAt(localized[locale], 'copy') as Record<string, unknown>;
            copy.label = '';
            if ('title' in copy)
                copy.title = 'Title';
            if ('summary' in copy)
                copy.summary = 'Summary';
        }
        const prepared = initializeSectionForm(localized, config, definition);
        for (const locale of siteLocales)
            expect(valueAt(prepared[locale], 'copy.label')).toBe('');
        const edited = changeFormValue(prepared, 'fr', field, '', 'Repère de section');
        expect(valueAt(edited.fr, 'copy.label')).toBe('Repère de section');
        expect(valueAt(edited.zh, 'copy.label')).toBe('');
        expect(initializeSectionForm(edited, config, definition)).toEqual(edited);
    }
    for (const key of ['home.statistics', 'home.business', 'about.structureSection']) {
        const definition = templateDefinition(key)!;
        expect(valueAt(blank(key).zh, 'copy.label')).toBeUndefined();
        expect(sectionContentSchema(definition.fields).safeParse(blank(key).zh).success).toBe(true);
    }
});
it('出口区块标识可留空保存草稿，发布时要求明确填写而不改变原标题或栏目名称', async () => {
    const page = fixture.pages.find(page => page.key === 'export')!;
    function media(value: unknown): unknown {
        if (Array.isArray(value))
            return value.map(media);
        if (value && typeof value === 'object')
            return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key === 'mediaId' && item ? '2026110214000000001' : media(item)]));
        return value;
    }
    const snapshot = { settings: { ...fixturePageSettings(), sceneEnabled: false }, sections: page.sections.map((section, index) => ({ ...section, sortOrder: index, visible: true, localized: media(section.localized) as LocalizedSections })) };
    await expect(validateFixturePublication('export', snapshot)).resolves.toBeUndefined();
    const section = snapshot.sections.find(section => section.templateKey === 'export.overviewSection')!, definition = templateDefinition(section.templateKey)!, config = sectionForms[section.templateKey]!;
    const copy = valueAt(section.localized.fr, 'copy') as Record<string, unknown>, summary = copy.summary;
    copy.label = '';
    expect(sectionContentSchema(definition.fields).safeParse(section.localized.fr).success).toBe(true);
    await expect(validateFixturePublication('export', snapshot)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    const field = config.groups.flatMap(group => group.fields).find(field => 'path' in field && field.path === 'copy.label') as ValueField;
    section.localized = changeFormValue(section.localized, 'fr', field, '', 'Présentation des activités');
    expect(valueAt(section.localized.fr, 'copy.summary')).toBe(summary);
    expect(snapshot.settings.sceneEnabled).toBe(false);
    await expect(validateFixturePublication('export', snapshot)).resolves.toBeUndefined();
});
it('所有在用模板都有明确编辑入口，配置字段和媒体槽均来自真实合同', () => {
    for (const definition of websiteTemplateCatalog) {
        const config = resolveSectionForm(definition);
        expect(config, definition.key).toBeDefined();
        expect(config.key).toBe(definition.key);
        if(sectionForms[definition.key])expect(config,definition.key).toBe(sectionForms[definition.key]);
        const original = blank(definition.key), before = structuredClone(original);
        const prepared = initializeSectionForm(original, config, definition);
        expect(original).toEqual(before);
        expect(initializeSectionForm(prepared, config, definition)).toEqual(prepared);
        for (const locale of siteLocales)
            expect(sectionContentSchema(definition.fields).safeParse(prepared[locale]).success, definition.key + ':' + locale).toBe(true);
        function visit(fields: FormField[], base = '') {
            for (const field of fields) {
                if (field.kind === 'slot') {
                    expect(definition.mediaSlots.some(slot => slot.key === field.key), definition.key + ':' + field.key).toBe(true);
                    continue;
                }
                if (field.kind === 'bannerImages') {
                    expect(contentField(definition, 'data.topics')?.kind).toBe('list');
                    continue;
                }
                const path = fieldPath(field, base);
                const contract = contentField(definition, path);
                expect(contract, definition.key + ':' + path).toBeDefined();
                if (field.kind === 'collection') {
                    expect(contract?.kind).toBe(field.tree?.roots === 'single' ? 'tree' : 'list');
                    if (field.tree) {
                        for (const [index, level] of field.tree.levels.entries()) {
                            const levelBase = index === 0 ? (field.tree.roots === 'single' ? path : `${path}.0`) : `${field.tree.roots === 'single' ? path : `${path}.0`}.${field.tree.childrenField}.0`;
                            visit(level.fields, levelBase);
                            const levelContract = contentField(definition, levelBase);
                            expect(levelContract, definition.key + ':' + levelBase).toBeDefined();
                        }
                    }
                    else
                        visit(field.fields ?? [], path + '.0');
                    for (const row of field.fixedRows ?? []) {
                        visit(row.fields, path + '.0');
                        for (const key of Object.keys(row.bindings ?? {}))
                            expect(contentField(definition, path + '.0.' + key)).toBeDefined();
                    }
                }
            }
        }
        for (const group of config.groups)
            visit(group.fields);
    }
    expect(sectionForms['contact.formSection']).toBeUndefined();
});

it('统一树合同同步维护不同层级的父子节点', () => {
    const key = 'product.cement_standards', definition = templateDefinition(key)!, config = sectionForms[key]!;
    const standards = config.groups.flatMap(group => group.fields).find((field): field is CollectionField => field.kind === 'collection')!;
    let localized = Object.fromEntries(siteLocales.map(locale => [locale, emptySectionContent(definition.fields)])) as LocalizedSections;
    let edit = beginCollectionEdit(localized, 'zh', definition, standards, null);
    edit.localized = changeFormValue(edit.localized, 'zh', { kind: 'text', path: 'country', label: '国家' }, 'data.standards.0', '中国标准');
    localized = finishCollectionEdit(localized, edit, definition, standards);
    const parent = collectionEditorRows(localized, 'zh', standards)[0]!;
    for (const code of ['GU', 'HE']) {
        edit = beginCollectionEdit(localized, 'zh', definition, standards, null, parent.key);
        const child = collectionEditorRows(edit.localized, 'zh', standards).find(row => row.key === edit.key)!;
        edit.localized = changeFormValue(edit.localized, 'zh', { kind: 'text', path: 'code', label: '型号代码' }, child.base, code);
        localized = finishCollectionEdit(localized, edit, definition, standards);
    }
    const firstModelId = String(valueAt(localized.zh, 'data.standards.0.models.0.id'));
    const secondModelId = String(valueAt(localized.zh, 'data.standards.0.models.1.id'));
    localized = moveCollectionRow(localized, 'zh', definition, standards, secondModelId, 'up');
    for (const locale of siteLocales) {
        expect(valueAt(localized[locale], 'data.standards.0.models.0.id')).toBe(secondModelId);
        expect((valueAt(localized[locale], 'data.standards.0.models') as unknown[])).toHaveLength(2);
    }
    localized = removeCollectionRow(localized, 'zh', definition, standards, firstModelId);
    for (const locale of siteLocales)
        expect((valueAt(localized[locale], 'data.standards.0.models') as unknown[])).toHaveLength(1);
});
it('统一树合同保留组织架构的递归层级和换父级能力', () => {
    const section = fixture.pages.flatMap(page => page.sections).find(section => section.templateKey === 'about.structureSection')!;
    const field = sectionForms[section.templateKey]!.groups.flatMap(group => group.fields).find((field): field is CollectionField => field.kind === 'collection')!;
    const rows = collectionEditorRows(section.localized as LocalizedSections, 'zh', field);
    expect(rows[0]).toMatchObject({ key: 'studwell', depth: 0, parent: null });
    expect(rows.some(row => row.depth === 2)).toBe(true);
    const trade = rows.find(row => row.key === 'trade')!;
    const edit = beginCollectionEdit(section.localized as LocalizedSections, 'zh', templateDefinition(section.templateKey)!, field, trade.key);
    const parents = collectionParentOptions(edit, field).map(option => option.value);
    expect(parents).toContain('studwell');
    expect(parents).not.toContain('cemsur-international');
});
it('招聘页面区块只保留界面文案，旧岗位与联系字段不会进入模板合同', () => {
    const fields = sectionForms['careers.positionsSection']!.groups.flatMap(group => group.fields);
    const template = templateDefinition('careers.positionsSection')!;
    expect(fields.some(field => 'path' in field && field.path === 'data.positions')).toBe(false);
    expect(fields.some(field => 'path' in field && field.path === 'copy.contactTitle')).toBe(false);
    expect(contentField(template, 'data.positions')).toBeUndefined();
    expect(contentField(template, 'copy.contactTitle')).toBeUndefined();
    expect(contentField(template, 'copy.contactIntro')).toBeUndefined();
    expect(templateDefinition('contact.cta')).toMatchObject({ name: '联系引导', allowedPages: 'all' });
});
it('共享字段在语言条目顺序不一致时不按错误索引覆盖', () => {
    const key = 'home.statistics', definition = templateDefinition(key)!, config = sectionForms[key]!;
    const prepared = initializeSectionForm(blank(key), config, definition);
    const rows = valueAt(prepared.en, 'data.statistics.statistics') as unknown[];
    rows.reverse();
    const number: ValueField = { kind: 'number', path: 'value', label: '数值', shared: true, min: 0 };
    expect(() => changeFormValue(prepared, 'zh', number, 'data.statistics.statistics.0', 25, 'key')).toThrow('结构不一致');
});
it('链接允许逐字输入，任一语言的无效地址仍阻止保存', () => {
    const key = 'home.about', config = sectionForms[key]!, field = config.groups.flatMap(group => group.fields).find(field => field.kind === 'link') as ValueField;
    let draft = changeFormValue(blank(key), 'zh', field, '', {type:'custom',value:'h'});
    expect(valueAt(draft.zh, field.path)).toEqual({type:'custom',value:'h'});
    expect(sectionFormLinkErrors(draft, config)).not.toEqual([]);
    draft = changeFormValue(draft, 'zh', field, '', {type:'custom',value:'https://example.com'});
    expect(sectionFormLinkErrors(draft, config)).toEqual([]);
    draft = changeFormValue(draft, 'fr', field, '', {type:'custom',value:'javascript:alert(1)'});
    expect(sectionFormLinkErrors(draft, config)).not.toEqual([]);
});
const statisticsContent = () => structuredClone(fixture.pages.flatMap(page => page.sections).find(section => section.templateKey === 'home.statistics')!.localized) as LocalizedSections;
it('指标数值和年份跨语言同步，固定单位关联，名称和说明保持各语言原值', () => {
    const original = statisticsContent(), before = structuredClone(original);
    let next = setStatistic(original, 'capacity', 888);
    next = setStatisticYear(next, 2026);
    next = editLocale<StatisticsContent>(next, 'zh', value => { value.copy.capacity = '年度产能'; value.data.statistics.statisticsReporting.source = '年度报告'; });
    for (const locale of siteLocales) {
        const current = next[locale] as StatisticsContent, previous = original[locale] as StatisticsContent;
        expect(current.data.statistics.statistics.find(row => row.key === 'capacity')).toMatchObject({ value: 888, unitKey: 'home.statistics.units.tenThousandTonnesPerYear' });
        expect(current.data.statistics.statisticsReporting.year).toBe(2026);
        if (locale !== 'zh')
            expect(current.copy).toEqual(previous.copy);
        expect(current.data.statistics.statistics.filter(row => row.key !== 'capacity')).toEqual(previous.data.statistics.statistics.filter(row => row.key !== 'capacity'));
    }
    expect(original).toEqual(before);
    for (const locale of siteLocales)
        expect(sectionContentSchema(templateDefinition('home.statistics')!.fields).safeParse(next[locale]).success).toBe(true);
});
it('空白指标建立五项受控行，不丢失已有数据，非法数值不会写入', () => {
    const original = blank('home.statistics'), next = initializeStatistics(original);
    for (const locale of siteLocales)
        expect((next[locale] as StatisticsContent).data.statistics.statistics).toHaveLength(5);
    expect(initializeStatistics(next)).toEqual(next);
    for (const value of [-1, NaN, Infinity])
        expect(() => setStatistic(next, 'capacity', value)).toThrow();
    for (const year of [0, 1.5, 10000, NaN])
        expect(() => setStatisticYear(next, year)).toThrow();
    expect((original.zh as StatisticsContent).data.statistics.statistics).toHaveLength(0);
    expect((next.zh as StatisticsContent).copy.reportingYear).toBe('{year}');
    const label = changeFormValue(next, 'zh', statisticsForm.groups[2]!.fields[1] as ValueField, '', '统计年度：{year}');
    expect((label.zh as StatisticsContent).copy.reportingYear).toBe('统计年度：{year}');
    expect(label.en).toEqual(next.en);
    for (const locale of siteLocales)
        expect(sectionContentSchema(templateDefinition('home.statistics')!.fields).safeParse(next[locale]).success).toBe(true);
});
