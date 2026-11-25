// Business action outcome; presentation layers map it to Toast, feedback or routing.
export interface AdminActionResult {
    status: 'success' | 'error'
    message: string
}

// 批量操作部分成功或写入成功后刷新失败时，保留独立的警告结果。
export interface AdminOperationResult {
    status: 'success' | 'warning' | 'error'
    message: string
}
