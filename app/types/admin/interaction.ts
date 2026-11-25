// 后台页面确认和通知的交互契约，不保存业务数据。
export interface AdminConfirmation {
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel?: string
}

export interface AdminToastNotification {
    message: string;
    tone?: 'success' | 'error' | 'warning'
}

