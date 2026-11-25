// 招聘岗位公开投影：服务端与官网共享当前语言字段，不包含草稿、版本或发布状态。
export interface PublicCareerPosition {
    id: string
    title: string
    department: string
    location: string
    responsibilities: string[]
    requirements: string[]
}
