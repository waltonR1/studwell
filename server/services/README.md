# Service 层

负责业务规则、状态转换、事务协调、冲突处理及审计触发；通过 Repository 持久化，不直接调用 ORM。
`server/http/handlers` 中的 Handler 负责 HTTP、输入校验及认证/权限入口。业务模块连同 Repository、API、测试一起交付。

Database 由装配入口注入，执行器类型位于 `server/db/transaction.ts`；Service 通过 database.transaction() 组织事务，不直接调用 Drizzle，事务内各 Repository 必须使用同一个上下文。基础 HTTP 合同见[Server API 基础协议](../../docs/接口与数据约定.md)。

`runtime` 负责 Nuxt 私有配置和服务装配，仅供入口调用；HTTP 适配器通过参数接收依赖。`infrastructure` 负责系统采样和白名单诊断，不调用业务服务。

请求通常按 API / Middleware → HTTP Handler → 业务 Service → Repository → DB 调用；薄路由也可以直接调用业务 Service，但不能直接访问 Repository。任务 Runner / Worker 通过任务业务服务协调执行和持久化，状态协调不直接写 SQL。`core` 保存无框架依赖的错误、输入解析及操作者元数据，`policies` 保存纯业务约束；两者不得反向调用业务服务。

`roles.ts` 管理角色资料；`role-authorization.ts` 是角色权限和菜单的唯一业务写入口，仅接受同时包含菜单和权限的联合提交，不再提供单项接口或合并旧请求的提交模式。`menus.ts` 仅负责菜单树、排序、导航和页面绑定。菜单移除及其必要权限移除必须联合提交；历史不一致授权应通过联合接口修复。

`access` 保存权限快照及范围读取，`operations` 保存事务与审计协调；不得回调上层业务模块。成功审计与业务同事务提交，失败审计在回滚后记录。写事务继续实时复核权限；请求内复用认证身份不等于缓存授权结果。

运行 `npm test` 会检查后端循环依赖、底层反向引用、Service/任务编排直接导入 HTTP 或 ORM。真实数据库回归使用 `npm run test:db`，仅允许专用测试库。测试夹具可构造隔离权限或历史授权状态，不能作为生产授权入口使用。

实体写入使用 `shared/schemas/entity.ts` 的有界版本合同，常量来自 `shared/config/entity-versions.ts`。任务配置与其他实体一样通过仓储 CAS 更新版本；不能通过通用任务进度更新方法改写 version。

任务事务协调位于 `services/tasks`，运行入口位于 `server/tasks`。业务服务只能调用前者；时间计划、重试和续批策略依赖 `policies`，不得为了复用计算而导入 Runner 或 Worker。
