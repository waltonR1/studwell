import {describe, expect, it, vi} from 'vitest'
import {auditChanges, auditReferences} from '../../server/policies/audit-changes'
import {validateAuditChanges, readAuditChanges} from '../../server/schemas/log-changes'
import {auditService} from '../../server/services/audit'
import {auditRepository} from '../../server/repositories/audit'
import {logChangeSetDifference, logChangeSummary, logChangeValueText} from '../../shared/utils/admin/log-changes'

describe('受控审计变更', () => {
    it('只保留实际业务差异，忽略密码、版本和更新时间', () => {
        const context = auditChanges('user', {displayName: '旧名', enabled: true, version: 1, passwordHash: 'secret'}, {displayName: '新名', enabled: true, version: 2, passwordHash: 'other'})
        expect(context.fields).toEqual([{field: 'displayName', before: '旧名', after: '新名'}])
        expect(auditChanges('role', {name: '相同', version: 1}, {name: '相同', version: 2}).fields).toEqual([])
        expect(logChangeSummary({version: 1, mode: 'update', fields: []})).toBe('无业务字段变化')
    })
    it('联系方式仅记录变更事实，两个已脱敏值相同时仍保留真实变更', () => {
        const context = auditChanges('user', {email: 'before@example.test', phone: '13800000001'}, {email: 'after@example.test', phone: '13800000002'})
        expect(context.fields).toHaveLength(2)
        expect(JSON.stringify(context)).not.toMatch(/example|138000/)
        expect(validateAuditChanges(context, 'user')).toEqual(context)
        expect(auditChanges('user', {email: 'same@example.test'}, {email: 'same@example.test'}).fields).toEqual([])
    })
    it('集合按标识比较、不受顺序影响；保留当时名称与新增移除项', () => {
        const catalog = [{id: '1', name: '管理员'}, {id: '2', name: '审计员'}]
        const before = auditReferences(['2', '1'], catalog), after = auditReferences(['1', '2'], catalog)
        expect(auditChanges('user', {roles: before}, {roles: after}).fields).toEqual([])
        expect(logChangeSetDifference(before, auditReferences(['2', '3'], catalog))).toEqual({added: [{id: '3', name: '3'}], removed: [{id: '1', name: '管理员'}]})
        expect(logChangeValueText(before)).toContain('管理员（1）')
    })
    it('新增、删除保留关键快照；null、false、0互不混淆', () => {
        expect(auditChanges('menu', null, {name: '目录', parentId: null, sortOrder: 0, visible: false}).mode).toBe('create')
        expect(auditChanges('menu', {name: '目录'}, null)).toMatchObject({mode: 'delete', fields: [{field: 'name', before: '目录', after: null}]})
        expect(auditChanges('parameter', {value: null}, {value: false}).fields).toHaveLength(1)
        expect(auditChanges('parameter', {value: false}, {value: 0}).fields).toHaveLength(1)
    })
    it('拒绝未知字段、跨对象字段、原始联系方式、重复字段和超大载荷', () => {
        const context = auditChanges('role', {name: '旧'}, {name: '新'})
        expect(() => validateAuditChanges({...context, secret: 'secret'}, 'role')).toThrow()
        expect(() => validateAuditChanges({...context, fields: [{field: 'password', before: null, after: 'secret'}]}, 'user')).toThrow()
        expect(() => validateAuditChanges({...context, fields: [{field: 'email', before: null, after: 'raw@example.test'}]}, 'user')).toThrow()
        expect(() => validateAuditChanges({...context, fields: [{field: 'permissions', before: [], after: []}]}, 'menu')).toThrow()
        expect(() => validateAuditChanges({...context, fields: [...context.fields, ...context.fields]}, 'role')).toThrow()
        expect(() => validateAuditChanges({...context, fields: [{field: 'name', before: null, after: 'x'.repeat(2001)}]}, 'role')).toThrow()
        expect(readAuditChanges({version: 99}, 'user')).toBeNull()
        expect(readAuditChanges(null, 'user')).toBeNull()
    })
    it('失败审计丢弃变更数据；成功审计校验失败不会写入', async () => {
        const spy = vi.spyOn(auditRepository, 'audit').mockResolvedValue(1n)
        const input = {action: 'roles.update', targetType: 'role', result: 'failed' as const, createdAt: new Date(), ip: 'local', userAgent: 'fixture', requestId: 'fixture', changeContext: auditChanges('role', {name: '旧'}, {name: '新'})}
        await auditService.write({} as Parameters<typeof auditService.write>[0], input)
        expect(spy.mock.calls[0]?.[1].changeContext).toBeNull()
        spy.mockClear()
        await expect(auditService.write({} as Parameters<typeof auditService.write>[0], {...input, result: 'success', targetType: 'menu', changeContext: auditChanges('role', {permissions: []}, {permissions: [{id: 'read', name: '读取'}]})})).rejects.toThrow()
        expect(spy).not.toHaveBeenCalled()
    })
})
