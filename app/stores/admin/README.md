# Admin stores

业务 store 不引用 Toast 通知类型。单项命令使用 AdminActionResult；需要表达部分成功、写入后刷新失败的业务使用 AdminOperationResult（success/warning/error）。组件负责将 status 映射到通知 tone，媒体批次反馈也遵循此合同；字段校验错误继续留在所属表单状态。

账号、角色、菜单、字典、参数和日志反馈也统一使用 AdminOperationResult，不为各领域重复定义同结构的通知合同。反馈状态仍由所属业务作用域清理，Toast 组件只接收界面转换后的通知。

`module-image-rules.ts` 管理数据库模块图片规则的共享读取、加载错误和重试，沿用服务端 content.media.read 权限。使用者共享请求，最后一个编辑作用域退出、身份切换或权限撤销时清理。区块图片仍读取自身模板修订规则，不使用该模块规则查询。

`site-modules.ts` 按模块键保存状态、引用清单和请求进度，通过 `api/admin/site-modules` 读写，返回 AdminActionResult。多个管理行相互隔离；使用者计数由页面 composable 接线，同一模块最后一个使用者退出时释放状态，身份切换或读取权限撤销时同步清理。Toast 不进入业务 store。

`site-languages.ts` 管理语言草稿、保存基线和发布版本；`website-routes.ts` 管理路由、SEO 草稿及发布命令。两者通过各自 API 适配器请求，负责身份切换、离开重置和迟到响应隔离，写操作返回 AdminActionResult。确认、Toast、历史窗口与目录折叠由 website composable 负责。

`navigation-targets.ts` 独立管理站内链接目标的加载、错误与重试，通过 `api/admin/navigation-targets` 请求，不依赖页面草稿。区块字段共享该查询，顶层表单卸载时 reset；身份代次变化同步清理，并拒绝迟到响应。当前遵循单个活动后台编辑路由约定，不承载页面内容或装配状态。

后台业务 Pinia store 按业务模块维护，仅持有该业务的数据、派生状态、异步动作及进入/离开生命周期。

- 使用 Setup Store 和显式 action，不新增通用 CRUD 工厂或万能 Context。
- 对外命名交互类型归 types/admin，调用方直接从类型目录导入，不经 store 转导出；初始草稿工厂仍留在所属业务 store。轮询间隔和界面分页回退值归 config/admin。
- 菜单、字典、参数的身份清理由 watch 直接观察 session.generation，不额外镜像仅用于比较的身份版本；账号、角色用于请求一致性判断的版本快照仍保留。
- 强制单向目录依赖：store 可依赖其他 store、api、utils/config/types/shared，禁止导入项目 composables、组件、页面或布局。API 和工具层禁止反向导入 store。Nuxt 内置请求能力不属于项目 composables 目录，但下层不得通过自动导入后台函数绕过规则。
- 页面负责何时进入、路由触发、确认框、Toast、DOM 与秘密输入；store 负责请求、草稿、基线、响应顺序和业务清理。
- URL 查询是列表条件的权威来源。store 接收规范化查询或实体 ID，不持有 route/router。
- 请求状态保存受控错误文案、错误码或非敏感结果，不保存 Response、DOM、函数或密码。
- 身份、导航和偏好各有独立 store；业务 store 直接读取 session store 的权限与身份代次，在自身作用域清理，身份 store 不反向依赖全部业务 store。

当前 store：

- `session.ts`：会话、权限、恢复状态和身份代次，不反向依赖业务 store。
- `request.ts`：请求协调 action 的唯一入口，依赖 session/notice/navigation 基础 store 与 api/http；处理认证、CSRF、旧请求失效和恢复地址，不创建业务草稿、计时器或浏览器下载链接。
- `notice.ts`：跨页面请求恢复横幅，不替代页面 Toast 或表单错误。
- `navigation.ts`：导航数据、加载/错误状态、身份键、请求顺序和业务写入失效标记；请求函数由框架层传入。
- `preferences.ts`：当前账号分页偏好、版本缓存和请求竞争。
- `users.ts`：账号列表、目录、创建草稿、详情分区草稿和账号动作；`personal` 分区独立管理本人资料、校验、保存和离开清理。
- `roles.ts`：角色列表、详情资料、权限与页面菜单联合授权及共享版本。
- `menus.ts`：菜单树、页面目录、编辑草稿、显示/排序/删除动作。
- `parameters.ts`：参数列表、本地查询分页、参数组草稿、关联校验和批量保存。
- `dictionaries.ts`：字典类型与选项共享详情版本，分别维护类型和选项草稿。
- `tasks.ts`：任务快照、配置草稿、执行记录与详情、任务操作和唯一轮询；组件通知进入/离开、可见性及确认暂停，不在 SSR 启动计时器。
- `logs.ts`：当前日志类别、URL 查询快照与筛选草稿、列表/详情请求及 CSV 导出反馈；焦点、剪贴板和技术区展开由详情组件持有。
- `environment.ts`：系统环境快照、请求顺序、过期提示和唯一轮询；页面通知可见性，离开或撤权后停止轮询并拒绝迟到响应。
- `dashboard.ts`：首页统计与加载状态，入口和指标链接直接投影 `navigation` store，不持有导航副本。

认证秘密输入仍由 `useAdminAuthForm` 的表单作用域持有；request store 执行认证 action 并更新 session store，旧代次认证写入不能清除新身份。原 useAdminApi/useAdminAuth/useAdminLogDownload 已删除，不保留兼容入口。

各业务 store 会在身份版本变化、实体切换和离开页面时失效旧请求或清理对应业务状态。导航 DOM 状态、localStorage、媒体查询、页面 Toast、确认框和秘密输入继续由组件作用域持有。

## 单页面与资源规则

每个 Nuxt 应用内同一业务使用一份 store，现阶段按单个活动后台路由设计。列表离开标记重新验证或释放请求，编辑器按当前实体 ID 建立草稿并在离开清理；本人资料使用 users.personal 独立分区。未实现同一业务的多页签/多实例草稿缓存，新增此需求时再明确隔离策略。

页面卸载通知业务 leave，不调用共享 store 的 `$dispose()`。store 作用域负责 watcher；任务定时器由 startPolling/stopPolling/leave 管理并通过 onScopeDispose 最终回收。刷新注册只接线当前业务 action，不持有第二份 busy、实体或草稿。页面的 mounted/unmounted 仅用于通知、DOM 解绑和秘密清理。

修改业务字段沿“所属表单/既有 shared schema → 对应业务 store → api/admin”定位；列表、分区草稿、请求顺序和保存基线均在该 store。composable 只在需要确认、通知或页面接线时组合业务动作，不建立原样转发全部 store 的代理。

业务 API 在 store setup 中以 `createUsersApi(requestStore)` 创建，传输接口只包含 read/mutate/download，不携带业务状态。基础 session/notice/navigation 不反向依赖 request store；新增依赖需通过运行时导入图无环检查。Blob、DOM 和请求实例不进入可序列化 state。

- `site-settings.ts`：网站标识、页头、页脚的草稿、读取/保存、独立发布/回滚和历史详情；动作返回一次通知结果，Toast 仍由页面展示。离开和身份切换使旧请求失效。
- `media-selection.ts`：Logo/图标两个独立选图查询作用域，关闭时释放，不复用或覆盖媒体库列表页状态。
