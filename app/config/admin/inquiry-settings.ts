// 咨询邮件设置的字段标签、选项与文案预览样例；不读取数据库或持有草稿。
export const mailFields = [
  {key:'from', label:'统一发件地址'},
  {key:'defaultRecipient', label:'默认转发邮箱'},
  {key:'replyMailbox', label:'统一回信邮箱（也作兜底）'},
] as const
export const mailSwitches = [
  {key:'forwardEnabled', label:'自动转发新咨询', help:'通知默认邮箱或类型团队邮箱，可选只发提醒或附详情。'},
  {key:'replyEnabled', label:'允许从后台直接回复', help:'客户回信按下方设置发送，旧邮件不受后续转派影响。'},
  {key:'assignmentEnabled', label:'分派或转派时提醒新负责人', help:'只发编号和后台链接；自行认领、未配置工作邮箱或与团队通知地址相同时不重复发送。'},
] as const
export const forwardRoutes = [{value:'default',label:'统一发到默认邮箱'},{value:'category',label:'优先发到类型团队邮箱'}]
export const forwardContents = [{value:'notice',label:'仅发编号和后台链接'},{value:'details',label:'附客户资料和留言'}]
export const templateOptions = [{value:'notice',label:'简短提醒模板'},{value:'details',label:'完整详情模板'}]
export const previewValues = {
  id:'2026111026000000001', category:'产品与出口', link:'https://example.com/admin/inquiries?id=2026111026000000001',
  name:'示例客户', email:'customer@example.com', company:'示例公司', country:'中国', locale:'zh', message:'想了解产品规格和报价。',
}
export const replyRoutes = [{value:'default',label:'统一回信邮箱'},{value:'category',label:'类型团队邮箱优先'},{value:'assignee',label:'当前负责人工作邮箱优先'}]
