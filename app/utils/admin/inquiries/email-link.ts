// 生成咨询邮件客户端链接，编码地址和编号，不发送邮件。
export function emailLink(email: string, id: string) {
  return 'mailto:' + encodeURIComponent(email).replace('%40', '@') + '?subject=' + encodeURIComponent('[' + id + ']')
}
