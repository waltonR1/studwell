# Admin composables

`website/useSectionManagement` 接线独立区块的保存、媒体展示投影、预览和离开保护；初始 enter/leave 仍由区块路由入口负责，不重复加载。环境监控及个人资料组件中的少量生命周期、展示接线可就地保留，不为统一文件数量建立转发层。

`logs/useLogManagement` 接线日志 URL 查询和 CSV 浏览器下载，日志详情焦点及弹窗 ref 留在组件；`tasks/useTaskManagement` 接线任务操作确认、浏览器可见性和轮询暂停，轮询执行及任务业务状态仍归 tasks store。两者同步注册生命周期后返回 ready，组件顶层等待。

`media/useMediaLibraryManagement` 管理媒体列表查询同步、行身份、选择与预览窗口、编辑保护和删除确认；上传与删除队列仍由 media store 管理。入口先加载分页偏好，再同步注册交互生命周期并等待 ready，不复制上传任务或媒体草稿。

字典交互按作用域分为 dictionaries/useDictionariesListManagement（查询和列表生命周期）、useDictionaryDialog（类型保存与离开确认）、useDictionaryItemsManagement（选项切换、保存及取消）。后两者通过 onSaved 回调通知展示组件转发 saved 事件；共享版本、草稿和请求仍由同一 dictionaries store 管理。

`parameters/useParameterManagement` 接线参数列表加载、恢复默认确认、保存、刷新及未保存保护；参数关联规则、分区草稿和业务请求继续由 parameters store 与既有 utils 管理，列表组件只组合字段及操作入口。

`menus/useMenuManagement` 接线菜单筛选、编辑、隐藏和删除确认及新增页面后的导航，返回 ready 供入口等待。菜单树规则、授权和持久化保留在 menus store 与既有工具，ManagementModule 仅组合树表和编辑弹窗。

`roles/useRolesListManagement` 接线角色列表查询、创建与删除确认；`roles/useRoleDetailsManagement` 接线详情保存、目录刷新和离开保护。两者同步注册生命周期并返回 ready，入口顶层等待；授权计算、草稿及请求继续归 roles store 和既有 utils，不复制权限状态。

`users/useUserDetailsManagement` 管理详情分区保存、密码重置确认、目录刷新、路由切换保护和生命周期。密码只在本地作用域保留，身份或账号切换、卸载时清空；异步保存返回后复核身份和账号，不驱动旧窗口。实体分区草稿仍归 users store，详情组件负责展示。

`users/useUsersListManagement` 负责账号列表查询、创建弹窗和危险操作确认。初始密码只保存在当前组件作用域 ref，不进入 store；身份切换、卸载和已提交创建操作后清空，迟到结果不再驱动旧页面跳转。业务草稿和请求仍归 users store。

`inquiries/useInquirySettingsManagement` 协调咨询类型、邮件设置的加载、保存、分类编辑确认和通知，不复制 inquiry-settings store 草稿。字段标签、选项及预览样例位于 config/admin/inquiry-settings；设置组件负责字段展示和事件绑定。

`inquiries/useInquiryManagement` 管理列表 URL 同步、详情窗口、通知和可见性事件接线；投递轮询由 inquiries store 执行。同步注册生命周期，再返回 ready 供入口等待；静态标签归 config/admin/inquiry-list，邮件地址编码归 utils/admin/inquiries/email-link。

`careers/useCareersManagement` 统一招聘列表查询、确认通知、排序和生命周期接线。它同步注册 watcher 与卸载清理，返回 ready 供入口顶层 await 等待；分页偏好先由入口加载，岗位草稿和请求仍归 careers store。

`news/useNewsManagement` 管理新闻入口的列表 URL 同步、分类筛选、确认通知、预览与历史窗口及页面生命周期。文章、分类和运营数据仍由 news store 持有；NewsModule 负责界面装配，不直接实现交互流程或业务请求。

`website/useCollectionTableEditor` 管理单个集合字段的局部编辑草稿、媒体基线和确认校验，不写入全局 store；通过事件向父表单提交已确认结果。`preview/useNewsArticlePreview` 组合新闻布局接口、图片规则和纯数据投影；异步完成后的页面上下文注入由 SFC 顶层 await 恢复上下文后执行。

`preview/providePreviewData` 是后台预览装配入口，组合站点设置与 news、careers、inquiries 提供器。各业务文件负责对应公开注入合同的样例适配，不请求正式业务数据；咨询预览提交为空操作。新增业务时添加所属提供器并在入口登记，不把字段处理加入公共入口。

`useModuleImageRules` 只接线组件挂载、启用条件和作用域释放，返回规则及加载状态；请求与缓存归所属 store。网站标识、新闻图片字段在规则可用前禁用图片编辑，失败复用 Feedback 和重试按钮；页头、页脚编辑不触发该查询。

后台 URL/路由接线和页面环境交互放在此目录，不依赖 `composables/public` 的页面交互逻辑。业务状态和请求协调由 `stores/admin` 持有，传输归 `api/admin`。依赖方向只能是本目录 → stores/api/utils/config/types/shared，store 和 API 不得导入本目录。

身份、请求恢复、导航、偏好、框架刷新及账号、角色、菜单、参数、字典、任务、日志、Dashboard 和本人资料已使用 Pinia。组件同步注册必要的环境生命周期，通过 `callOnce` 触发 SSR 初始加载，不使用 `useAsyncData` 再缓存同一份业务实体。

业务列表、编辑草稿、异步动作及进入/离开生命周期由对应 `stores/admin` 模块持有；页面模块负责 URL 查询、SSR 初始加载、未保存确认和通知展示。任务 store 独占轮询，日志 store 管理列表与详情，剪贴板和焦点留在组件。本人资料归账号 store 的 personal 分区。旧业务状态 composable 已删除，不保留同名代理。

`auth/useAdminAuthForm` 保留表单秘密输入、密码策略校验、离开保护、表单错误和路由接线；认证 action 直接调用 request store，身份归 session store。权限与 Root 投影直接读取 session store。密码仅作为请求参数，不放入 Pinia state。原 useAdminApi/useAdminAuth/useAdminLogDownload 已删除；CSV 文件由 store 返回，浏览器下载由页面执行。

网页维护的编辑状态由 `website-pages` store 管理，产品未配置状态也由页面资源返回；旧占位查询已移除。`useAdminDetailLabel` 的 `useState` 仅用于页面与框架之间的文案接线，不缓存业务实体。

`forms/useAdminUnsavedGuard.ts` 集中处理后台表单的路由离开确认和浏览器关闭保护：

- `dirty` 只覆盖当前页面仍在编辑的字段；弹窗表单可结合 `active` 限制作用范围。
- 有修改且确认离开后才放行；无修改或提交成功后先重置 dirty，再重定向。
- 主动刷新需要丢弃修改时复用返回的 `guard()`，避免各模块重复实现 `beforeunload` 或原生 `window.confirm`。
- 业务模块自行定义 dirty 基线和保存成功后的重置时机，composable 不缓存表单或业务实体。

## Unified refresh

`navigation/useAdminRefresh.ts` 提供后台当前页面的刷新注册机制：

- `Frame.vue` 提供每个后台页面共享的刷新注册表。
- 页面模块通过 `useAdminRefresh(refresh, confirm?)` 注册实际数据重新请求函数和可选未保存确认。
- 顶栏刷新先确认所有当前页面守卫，再刷新权限和动态导航，随后并发执行当前页面的数据刷新函数。
- 刷新函数必须重新请求真实数据，并保留现有路由筛选、分页和业务状态；不得用 `location.reload()` 或只重置视觉状态替代。
- 一个页面按需注册多个独立目标，例如字典列表与当前字典编辑器；角色详情及联合授权统一调用角色 store 的刷新动作。页面卸载时注册自动移除。

- 页面提交状态使用只读的 `useAdminBusy(() => store.busy)` 投影，提交锁只在业务 store 写入；该接线没有本地提交 ref 或兼容 setter。提交期间禁用顶栏刷新，全局刷新锁在所有目标完成前持续禁用写入。
- 确认放弃草稿后，成功刷新必须重建表单基线或清理弹窗；取消确认不请求数据。
- 页面可以保留局部错误提示，但必须继续抛出刷新异常，防止顶栏误报成功。多个目标全部结束后再释放刷新锁。

## Detail label

`navigation/useAdminDetailLabel.ts` 向后台 Frame 提供当前详情页的名称和父级链接，随组件作用域清理，不参与鉴权。详情页提供名称后才显示末级面包屑。禁止把账号资料、密码或授权数据放入该导航状态。

## 页面作用域交互

- `useAdminActionConfirm` 为页面创建独立确认实例，配套 common/ConfirmDialog；scope 销毁取消挂起 Promise，不持有业务请求。Layout 与页面守卫共用结构化 `AdminConfirmation`，不再提供字符串协议包装。
- `useAdminToast` 提供独立 notification/show/dismiss，配套 common/Toast；不存放密码或请求载荷，不替代 CSRF/权限请求级 Notice。
- `useInitialPassword` 维护生成/复制反馈，密码由调用方表单持有和清理。复制失败受控处理，清空后的异步返回不重新显示提示。

命名交互类型直接归 types/admin：确认与 Toast 使用 interaction.ts，刷新注册使用 refresh.ts，列表接线参数使用 list.ts，详情文案使用 navigation.ts；调用方直接导入，不经 composable 转导出。刷新注入 key 留在提供/消费模块，局部 refs 和 DOM 清理仍由组件作用域管理。紧凑导航媒体查询归 config/admin/navigation.ts。

目录按接线职责组织：auth 为认证表单，forms 为密码交互和未保存保护，interaction 为确认与通知，list 为列表 URL 接线，navigation 为框架、导航偏好、刷新注册和详情文案，website 为网站维护操作的确认、通知和窗口协调。模块显式导入目标文件，不新增 index.ts 或旧路径兼容入口。

网站公共维护的业务草稿和请求已归 `stores/admin/site-settings.ts`；不保留 useSiteSettings 代理。选图与历史详情组件只通知进入/离开、读取对应 Store 状态。

`website/useWebsitePageActions` 和 `website/useSiteSettingsActions` 分别承接页面资源、公共分区的操作交互：先确认，再调用所属 Store action，并处理通知与窗口关闭。仅持有页面作用域的确认、通知和窗口状态；不缓存业务实体，不接管请求竞争、版本校验、提交锁或路由进入退出。Module 显式传入公共分区及语言 getter，以调用时的值执行操作。

website/usePageMaintenance 与 useSiteMaintenance 提供状态投影和操作契约，不导入组件、不缓存第二份草稿。各领域 MaintenanceModule 装配字段、历史组件和专属动作；shared/MaintenanceFrame 注册统一生命周期及公共操作，适配器提供 enter/leave/load 回调。公共框架不登记业务类型、不读取路由参数，也不生成预览地址。
