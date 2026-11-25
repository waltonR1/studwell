# Repository 层

仅负责 Drizzle 查询与持久化；复用 `server/db` 连接和 Schema。不决定 HTTP 状态或业务授权。
Service 组织事务并向参与的 Repository 传递同一事务上下文。实际模块按纵向任务添加，不预建通用 CRUD。

上下文类型使用 `server/db/transaction.ts` 的 DatabaseExecutor/DatabaseTransaction。写方法必须显式使用传入上下文，不能悄悄改用全局连接；高精度 ID 对外保持字符串，排序字段由代码固定。
