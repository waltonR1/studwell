# Admin API adapters

后台前端业务请求适配层，按任务、菜单、字典、参数、账号、角色、日志和 Dashboard 维护，只调用 `/api/admin/*`。

业务端点使用 `createUsersApi(client)` 等明确工厂，集中维护路径、方法、载荷与返回类型；只接收 `types/admin/api.ts` 中的 AdminApiClient 传输接口，不接收业务 ref、确认框、路由或大参数 Context。不读取 store，不导入 composables，不弹提示或注册页面生命周期。

`http.ts` 只负责同源 HTTP、SSR 凭据/响应 Cookie 传输和返回合同，不处理身份状态或导航。允许调用 Nuxt 内置请求能力，禁止导入项目的 composables/stores。CSRF、身份恢复、认证动作、权限刷新和业务写入后的导航失效由上层 `stores/admin/request.ts` 协调；会话和权限的权威状态仍在 session store。中间件通过 action 参数传入目标地址，不能将页面恢复地址写成共享可变配置。

CSV 端点返回 `{blob, filename, count}`；Blob 仅作为 action 返回值，不能进入 store state。浏览器链接创建/点击和 URL 回收由页面处理。账号、角色、菜单、字典输入通过 types/admin/api-inputs.ts 从现有 shared schema 推导，任务/参数输入直接使用 shared schema 推导的类型，日志列表直接使用共享 LogList；禁止在 API 内重新声明同形合同。任务历史查询区分字符串原始输入与解析后的数值分页。

目录依赖：`页面/组件 → composables → stores → api → utils/config/types/shared`；上层可以跳过中间层直接依赖下层，反向导入由 lint 拒绝，同层间接回环由单测检查。

`request-debug.ts` 为后台设置日志前缀和请求路径，耗时统计、错误响应读取和控制台输出与官网共用 `utils/api-request-debug.ts`。纯错误分类与路径处理由 `utils/api-diagnostics.ts` 提供。

开发模式通过 `config/admin/api.ts` 的 `import.meta.dev` 自动开启统一 API 控制台日志，生产模式关闭。读取、会话、认证、写入、上传（含 XHR 进度）及导出均记录方法、路径、状态、耗时和请求编号；失败补充受控错误编码及 NETWORK_ERROR / ABORTED / TIMEOUT / INVALID_RESPONSE / HTTP_ERROR / API_ERROR 等分类。查询值、请求体、请求头、完整响应和文件内容不打印。SSR 请求在服务端控制台查看，浏览器请求在开发者工具 Console 查看，不写入数据库。

公共维护端点统一由 createSiteSettingsApi 提供读取、保存、发布、回滚和历史详情方法，调用方只使用所属业务 Store action。
