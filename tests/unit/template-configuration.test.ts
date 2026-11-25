import {expect,it} from 'vitest'
import {templateDefinition} from '../fixtures/reference/template-catalog'
import {assertTemplateConfiguration} from '../../server/policies/template-configuration'
import {templateEditorGroups,templateEditorLabels,templateEditorSections} from '../../app/utils/admin/website/template-configuration'
it('允许现有字段的显示与约束配置，拒绝结构、槽位、编辑器绑定变化',()=>{
 const original=templateDefinition('content.text')!,next=structuredClone(original)
 next.category='后台分类';next.fields.label='内容字段';next.fields.fields!.copy!.fields!.title!.searchable=false
 expect(()=>assertTemplateConfiguration(next,original)).not.toThrow()
 for(const mutate of [(d:typeof next)=>{d.fields.fields!.added={kind:'text',label:'新字段'}},(d:typeof next)=>{delete d.fields.fields!.copy},(d:typeof next)=>{d.dataSource='news'},(d:typeof next)=>{d.publicRendererId='other'}]){
  const bad=structuredClone(next);mutate(bad)
  expect(()=>assertTemplateConfiguration(bad,original)).toThrow()
 }
})
it('标签遍历不会暴露默认内容和绑定值作为结构配置',()=>{
 const editor={groups:[{title:'分组',fields:[{label:'字段',help:'说明',defaults:{label:'业务数据'},bindings:{title:'固定值'}}]}]}
 const labels=templateEditorLabels(editor)
 expect(labels.map(row=>row.path)).toEqual(['editor.groups.0.title','editor.groups.0.fields.0.label','editor.groups.0.fields.0.help'])
 labels[0]!.target.title='新分组'
 expect(editor.groups[0]!.title).toBe('新分组')
})
it('拒绝无效范围和重复槽位',()=>{
 const bad=structuredClone(templateDefinition('content.text')!)
 bad.fields.fields!.copy!.fields!.title!.min=20;bad.fields.fields!.copy!.fields!.title!.max=10
 expect(()=>assertTemplateConfiguration(bad)).toThrow()
})
it('按原表单分组保留祖先名称和可编辑引用',()=>{
 const editor={groups:[{title:'指标',fields:[{label:'出口经验',fields:[{label:'展示数值',help:'单位说明'}]}]}]}
 const groups=templateEditorGroups(editor)
 const entry=groups[0]!.entries.find(row=>row.key==='help')!
 expect(groups[0]!.title).toBe('指标')
 expect(entry.path).toBe('editor.groups.0.fields.0.fields.0.help')
 expect(entry.context).toBe('出口经验 / 展示数值')
 entry.target.help='新说明'
 expect(editor.groups[0]!.fields[0]!.fields[0]!.help).toBe('新说明')
 expect(templateEditorGroups(null)).toEqual([])
})
it('同一项目的名称说明归在一起，同名项目按结构路径分开',()=>{
 const editor={groups:[{title:'业务区介绍',fields:[{label:'展示标题',help:'第一项说明'},{label:'展示标题',help:'第二项说明'}]}]}
 const sections=templateEditorSections(templateEditorGroups(editor)[0]!.entries)
 expect(sections.map(section=>section.title)).toEqual(['分组设置','展示标题','展示标题'])
 expect(sections.map(section=>section.entries.length)).toEqual([1,2,2])
 expect(sections[1]!.path).not.toBe(sections[2]!.path)
 sections[1]!.entries[1]!.target.help='新说明'
 expect(editor.groups[0]!.fields[0]!.help).toBe('新说明')
 expect(editor.groups[0]!.fields[1]!.help).toBe('第二项说明')
})
