// 任务配置表单草稿；未完成的输入由表单及共享 schema 校验。
export interface AdminTaskDraft {
    mode: string
    time: string
    minutes: number
    expression: string
    login: number
    audit: number
    security: number
}
