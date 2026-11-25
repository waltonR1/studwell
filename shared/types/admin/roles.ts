// 后台角色、权限目录与当前账号权限快照的 API 响应契约，供服务端投影与管理页面共用。
export interface RoleRecord {
    id: string
    code: string
    name: string
    enabled: boolean
    version: number
    createdAt: string
    updatedAt: string
    createdBy: string | null
    updatedBy: string | null
}

export interface RoleListRecord extends RoleRecord {
    userCount: number
}

export interface RoleDetail extends RoleRecord {
    permissions: string[]
}

export interface RolePermission {
    code: string;
    name: string;
    available: boolean;
    grantable: boolean
}

export interface AdminPermissions {
    isRoot: boolean;
    permissions: string[];
    version: string
}
