// 系统参数静态定义、默认值与边界；参数读取及生效规则由服务层处理。
import {rateScopes} from './rate-scopes'
import {LOG_EXPORT_HARD_LIMIT} from '#shared/config/admin/logs'
// 代码登记参数元数据和校验边界；默认值和覆盖值均由数据库提供。
import {z} from 'zod'
import {PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH} from '#shared/config/admin/password.ts'
import {ADMIN_PAGE_SIZES} from '#shared/config/admin/pagination.ts'
import type {ParameterGroup, ParameterValue} from '#shared/types/admin/parameters.ts'
import {pageSizeValueSchema, logExportLimitValueSchema} from '#shared/schemas/admin/parameters'

export interface ParameterDefinition {
    key: string;
    name: string;
    description: string;
    type: 'number' | 'boolean';
    group: ParameterGroup;
    unit: string;
    effect: string;
    consumers: string
    min?: number;
    max?: number;
    allowedValues: readonly number[];
    security: boolean;
    editable: boolean;
    schema: z.ZodType<ParameterValue>
}

function number(key: string, name: string, group: ParameterGroup, min: number, max: number, unit: string, consumers: string, description = ''): ParameterDefinition {
    return {
        key,
        name,
        group,
        min,
        max,
        unit,
        consumers,
        description,
        type: 'number',
        allowedValues: [],
        security: group !== 'general',
        editable: true,
        schema: z.number().int().min(min).max(max),
        effect: group === 'session' ? '仅新会话生效' : group === 'password' ? '下次设置密码生效' : '下一请求生效'
    }
}

export const listPageSizeDefinition: ParameterDefinition = {
    ...number('admin.list.defaultPageSize', '列表默认每页条数', 'general', 10, 50, '条', '账号、角色、字典、日志列表', '未指定每页条数时使用；显式 URL 优先，已打开列表不主动重置。'),
    allowedValues: ADMIN_PAGE_SIZES,
    schema: pageSizeValueSchema
}
export const logExportLimitDefinition: ParameterDefinition = {
    ...number('admin.logs.exportLimit', '日志单次导出数量上限', 'general', 100, LOG_EXPORT_HARD_LIMIT, '条', '三类日志导出', '超过上限整批拒绝，不截断；50000 是同步 CSV 的资源上界。'),
    schema: logExportLimitValueSchema
}
// 清理旧限流键必须使用所有策略允许的最大窗口，不能只看当前策略。
export const MAX_RATE_WINDOW_SECONDS = 86400
export const parameterDefinitions: readonly ParameterDefinition[] = [listPageSizeDefinition, logExportLimitDefinition,
    number('security.session.anonymousSeconds', '登录前会话有效期', 'session', 60, 3600, '秒', '登录页安全校验'),
    number('security.session.idleSeconds', '登录会话空闲时限', 'session', 60, 86400, '秒', '已登录会话', '空闲时限不能大于最长有效期。'),
    number('security.session.absoluteSeconds', '登录会话最长有效期', 'session', 300, 604800, '秒', '已登录会话及 Cookie'),
    number('security.password.minLength', '密码最少字符数', 'password', PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, '字符', '创建、重置、本人修改密码', '不能大于密码最多字符数。'),
    number('security.password.maxLength', '密码最多字符数', 'password', PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, '字符', '创建、重置、本人修改密码'),
    {
        key: 'security.password.blocklistEnabled',
        name: '检查已知弱口令',
        group: 'password',
        description: '启用后拒绝本地名单中的已知弱口令；名单不代表完整泄露密码库。',
        type: 'boolean',
        allowedValues: [],
        editable: true,
        security: true,
        unit: '',
        effect: '下次设置密码生效',
        consumers: '创建、重置、本人修改密码',
        schema: z.boolean()
    },
    ...rateScopes.flatMap(([scope, name]) => [
        number('security.rate.' + scope + '.count', name + '次数上限', 'rate', 1, 10000, '次', name, scope.endsWith('-log') ? '限制拒绝事件的记录频率，防止日志刷屏。' : '统计请求尝试次数，不只统计失败。'),
        number('security.rate.' + scope + '.windowSeconds', name + '统计窗口', 'rate', 1, MAX_RATE_WINDOW_SECONDS, '秒', name),
    ]),
]
