# 服务端职责边界

请求调用方向：`api / middleware → http → services → repositories → db`。入口使用 `runtime` 装配依赖，再将数据库和 HTTP 选项传给 Handler；Handler 不读取 Nuxt 私有配置来装配服务。

| 目录 | 职责 |
| --- | --- |
| `api`、`middleware`、`plugins` | 路由、认证拦截、应用启动与退出入口。 |
| `runtime` | 连接池、私有运行配置及服务的装配，供入口使用。 |
| `http` | HTTP 响应协议、请求 ID、输入读取、Cookie 和认证适配；`handlers` 按业务组织请求入口。 |
| `services` | 业务规则、事务和审计协调；`cleanup` 负责运行期清理编排，`menus/mapper.ts` 和 `logs/csv.ts` 负责响应投影。 |
| `repositories` | 数据库查询、锁、CAS 和实体写入；对外提供持久化接口。 |
| `db` | 数据库连接、表结构、事务类型和 ID 分配。 |
| `core` | 无框架依赖的错误合同、数据库错误分类、输入解析和操作者上下文。 |
| `policies` | 纯业务计算，包括审计变更提取、日志结果约束和查询时间范围；不依赖 HTTP、ORM 或运行装配。 |
| `schemas` | 服务端持久化数据的校验和读取合同。 |
| `config` | 静态目录、默认值和硬边界，见[配置说明](config/README.md)。审计字段白名单由计算和校验共同引用。 |
| `infrastructure` | 系统环境采样、受限诊断输出；不调用业务服务。 |
| `tasks` | 常驻 Runner 与独立 Worker 的运行入口；管理定时器、子进程、IPC、心跳和退出。 |
| `data` | 随服务部署的静态资料。 |

纯策略和配置不能反向调用 Service、Handler 或运行入口。HTTP 适配器不能调用 `runtime`；装配只发生在入口。模块被迁移后直接更新调用方，不通过旧目录再导出。

显式初始化、预设角色和测试数据重建位于 `scripts/database`，运行期代码不得导入。文件顶部说明职责和调用边界，事务、锁顺序与发布一致性约束在实现旁补充说明。

类型随职责归属：请求和响应合同位于 `shared/types`，数据库执行器位于 `db`，模块私有类型就近定义；不建立集中收纳所有类型的目录。持久化记录不应由前端响应类型反向推导。

`tests/unit/backend-boundaries.test.ts` 校验静态导入／再导出中的循环、底层反向依赖以及 HTTP 和运行装配边界；它不替代对动态导入、业务流程和运行行为的测试。

菜单持久化类型 `MenuRow` 从 Repository 的表结构推导；响应转换由 Service 映射器负责。树策略仅接受 `MenuTreeNode` 最小结构，排序函数保留调用方的记录类型，不依赖 API 响应或 ORM。

清理调用方向：`tasks/executor → services/cleanup → repositories → db`。清理服务在每批事务内协调取消／租约复核、删除、审计和进度；Repository 只负责批次锁与删除。`policies/cleanup.ts` 负责纯时间边界和资源预算校验，控制接口定义在清理模块内部，不反向调用任务编排。

任务模块：`services/tasks.ts` 面向管理端业务操作；`services/tasks/state.ts` 协调入队、抢占、租约检查与收尾事务，`scheduling.ts` 在事务内确认到期并入队，`executor.ts` 协调一次执行及清理服务。纯计划计算位于 `policies/task-schedule.ts`，结束后的重试／续批计算位于 `policies/task-followup.ts`，两者不依赖运行入口或数据库。调用方向为 `tasks → services → repositories`，业务服务不能反向引用 `tasks`。

`config/permissions.ts` 与 `config/menus.ts` 保存静态目录；路由匹配位于 `policies/admin-route.ts`，菜单路径投影位于 `policies/menu-path.ts`。这些函数的原配置路径不再导出。

导航目标标识计算位于 `policies/site-navigation.ts`，公开 SEO 的纯投影位于 `policies/website-seo.ts`；仓储负责读取 SEO 记录，`services/public-website-seo.ts` 负责解析媒体引用。不通过 Service 转导出仓储或策略函数。
