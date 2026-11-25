// 账号创建表单类型；密码只由弹窗短期持有，store 使用不含密码的草稿。
export interface AccountCreateDraft {
    username: string
    displayName: string
    email: string
    phone: string
    department: string
    position: string
    remark: string
}

export type AccountCreateTouched = Record<keyof AccountCreateDraft, boolean>

export type AdminUserSection = 'profile' | 'status' | 'roles' | 'password'


export type AdminUserListQuery = Record<string, string | number | undefined>

export type AdminUserWriteOutcome = {
    submitted: boolean
    succeeded: boolean
}

export type AdminUserListMutationOutcome = {
    fallbackPage?: number
}
