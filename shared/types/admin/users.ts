// 后台账号列表、详情、本人资料及操作能力的 API 响应契约；不包含密码、哈希或会话凭据。
import type {AccountDictionaryCatalog} from './dictionaries'

export interface UserRecord {
    id: string;
    username: string;
    displayName: string;
    email: string | null;
    phone: string | null;
    department: string | null;
    position: string | null;
    remark: string | null;
    isRoot: boolean;
    enabled: boolean;
    mustChangePassword: boolean;
    version: number;
    createdAt: string;
    updatedAt: string;
    createdBy: string | null;
    updatedBy: string | null;
    deletedAt: string | null
}

export interface UserActions {
    profile: boolean;
    roles: boolean;
    resetPassword: boolean;
    delete: boolean
}

export interface UserListRecord extends UserRecord {
    actions: UserActions;
    roles: { id: string; name: string; enabled: boolean }[];
    lastLoginAt: string | null
}

export interface UserDetail extends UserListRecord {
    roleIds: string[];
    manageable: boolean;
    createdByName: string | null;
    updatedByName: string | null;
    activeSessionCount: number;
    lastActivityAt: string | null
}

export interface PersonalProfile {
    username: string;
    displayName: string;
    email: string | null;
    phone: string | null;
    department: string | null;
    position: string | null;
    version: number;
    isRoot: boolean;
    dictionaryCatalog: AccountDictionaryCatalog
}

export interface UserRoleOption {
    id: string;
    name: string;
    enabled: boolean;
    grantable: boolean
}
