// 账号部门和岗位的展示转换；保留停用选项和未知历史值。
import type {AccountDictionaryOption} from '#shared/types/admin/dictionaries'

export function dictionaryItems(field: 'department' | 'position', options: AccountDictionaryOption[], current: string | null, dictionaryEnabled: boolean) {
  const active = dictionaryEnabled ? options.filter(option => option.enabled).map(option => ({
    label: option.name,
    value: option.code
  })) : []
  if (current && !active.some(option => option.value === current)) {
    const previous = options.find(option => option.code === current)
    active.unshift({label: previous ? `${previous.name}（已停用）` : `历史值：${current}`, value: current})
  }
  return [{label: field === 'department' ? '未设置部门' : '未设置岗位', value: ''}, ...active]
}

export function dictionaryLabel(options: AccountDictionaryOption[], value: string | null) {
  if (!value) return '—'
  const option = options.find(item => item.code === value)
  return option ? `${option.name}${option.enabled ? '' : '（已停用）'}` : value
}

