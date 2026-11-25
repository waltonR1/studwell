// 发布内容摘要统一基于 MySQL JSON 存储表示，避免 JS 对象键顺序与持久化表示不同。
import {sql} from 'drizzle-orm'

export function contentHash(content:unknown) {
    return sql<string>`SHA2(CAST(CAST(${JSON.stringify(content)} AS JSON) AS CHAR CHARACTER SET utf8mb4), 256)`
}
