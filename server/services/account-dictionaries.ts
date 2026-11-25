// 读取并校验账号关联字典字段，持久化由仓储负责。
import {accountDictionaryDefinitions, type AccountDictionaryField} from '../config/dictionaries'
import type {AccountDictionaryCatalog, AccountDictionarySet} from '#shared/types/admin/dictionaries.ts'
import type {DatabaseExecutor} from '../db/transaction'
import {dictionaryRepository} from '../repositories/dictionaries'
import {ApiError} from '../core/errors'

type DictionaryFields = Partial<Record<AccountDictionaryField, string | null>>

async function readSet(db: DatabaseExecutor, dictionaryCode: string): Promise<AccountDictionarySet> {
    const snapshot = await dictionaryRepository.snapshotByCode(db, dictionaryCode)
    if (!snapshot) return {enabled: false, options: []}
    return {
        enabled: snapshot.dictionary.enabled,
        options: snapshot.items.map(item => ({code: item.code, name: item.name, enabled: item.enabled})),
    }
}

export async function readAccountDictionaryCatalog(db: DatabaseExecutor): Promise<AccountDictionaryCatalog> {
    const [departments, positions] = await Promise.all([
        readSet(db, 'account_department'),
        readSet(db, 'account_position'),
    ])
    return {departments, positions}
}

// 新增值必须在业务事务内确认字典与选项仍启用；未改变的原值允许在停用后继续保留。
export async function validateAccountDictionaryFields(db: DatabaseExecutor, next: DictionaryFields, current: DictionaryFields = {}) {
    for (const definition of accountDictionaryDefinitions) {
        if (!(definition.field in next)) continue
        const value = next[definition.field]
        if (value === undefined || value === null || value === current[definition.field]) continue
        const dictionary = await dictionaryRepository.findByCode(db, definition.dictionaryCode, true)
        const option = dictionary ? await dictionaryRepository.findItemByCode(db, dictionary.id, value, true) : undefined
        if (!dictionary?.enabled || !option?.enabled) {
            throw new ApiError('INVALID_INPUT', [{
                path: definition.field,
                message: `请选择当前启用的${definition.label}选项`
            }])
        }
    }
}
