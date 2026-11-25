// 后台 API 调试仅随开发模式开启，不写入数据库。
export const adminApiConfig = {
    debug: import.meta.dev,
}
