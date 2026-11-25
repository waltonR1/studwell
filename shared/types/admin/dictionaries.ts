// 后台字典列表、详情及账号字典选项的 API 响应契约，供服务端投影与管理页面消费共用。
export interface DictionaryMetadata {
    createdBy: string | null;
    updatedBy: string | null;
    createdAt: string;
    updatedAt: string
}

export interface DictionaryRecord extends DictionaryMetadata {
    id: string;
    code: string;
    name: string;
    description: string;
    enabled: boolean;
    version: number;
    optionCount: number;
    enabledOptionCount: number
}

export interface DictionaryItem extends DictionaryMetadata {
    id: string;
    dictionaryId: string;
    code: string;
    name: string;
    sortOrder: number;
    enabled: boolean
}

export interface DictionaryDetail extends DictionaryRecord {
    items: DictionaryItem[]
}

export interface DictionaryOption {
    id: string;
    code: string;
    name: string
}

export type DictionaryOptionsResponse = { changed: false; version: string } | {
    changed: true;
    version: string;
    dictionary: { id: string; code: string; name: string; enabled: boolean };
    items: DictionaryOption[]
}

export interface AccountDictionaryOption {
    code: string;
    name: string;
    enabled: boolean
}

export interface AccountDictionarySet {
    enabled: boolean;
    options: AccountDictionaryOption[]
}

export interface AccountDictionaryCatalog {
    departments: AccountDictionarySet;
    positions: AccountDictionarySet
}
