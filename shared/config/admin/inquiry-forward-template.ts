// 咨询转发模板允许的占位符、展开长度及适用范围，供管理界面和服务端预检共用。
export const forwardTemplateTokens = {
    id: {label: '咨询编号', max: 19},
    category: {label: '咨询类型', max: 80},
    link: {label: '后台链接', max: 1024},
    name: {label: '客户姓名', max: 100},
    email: {label: '客户邮箱', max: 254},
    company: {label: '公司', max: 120},
    country: {label: '国家或地区', max: 100},
    locale: {label: '提交语言', max: 8},
    message: {label: '留言内容', max: 3000},
} as const

export const forwardSubjectTokens = ['id', 'category'] as const
const noticeTokens = [...forwardSubjectTokens, 'link'] as const
export const forwardBodyTokens: Record<'notice' | 'details', readonly (keyof typeof forwardTemplateTokens)[]> = {
    notice: noticeTokens,
    details: [...noticeTokens, 'name', 'email', 'company', 'country', 'locale', 'message'],
}
