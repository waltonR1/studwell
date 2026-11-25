// 后台系统参数与管理端偏好的 API 响应契约；基础输入校验共享，参数定义和生效策略由服务端维护。
export type ParameterValue = number | boolean
export type ParameterGroup = 'general' | 'session' | 'password' | 'rate'

export interface ParameterRecord {
    id: string;
    key: string;
    name: string;
    description: string;
    type: 'number' | 'boolean';
    defaultValue: ParameterValue;
    allowedValues: readonly number[];
    min?: number;
    max?: number;
    editable: boolean
    group: ParameterGroup;
    unit: string;
    effect: string;
    consumers: string;
    security: boolean
    value: ParameterValue;
    override: ParameterValue | null;
    invalidOverride: boolean;
    version: number
    createdBy: string | null;
    updatedBy: string | null;
    createdAt: string;
    updatedAt: string
}

export interface AdminPreferences {
    version: string;
    pageSize: number
}

export type PreferenceResponse = { changed: false; version: string } | ({ changed: true } & AdminPreferences)
