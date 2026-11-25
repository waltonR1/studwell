# Admin components

咨询详情按展示职责分为 CustomerSummary（客户资料与留言）、HandlingForms（处理、跟进及回复输入）、DeliveryTimeline（跟进和邮件投递记录）。输入通过 v-model 连接原 store 草稿，操作通过事件回到 ListModule，不在子组件读取 store 或发送请求；详情共用样式由 inquiry-detail.css scoped 引入。

招聘 PositionEditorDialog 承载岗位字段、多语言输入与弹窗样式，使用 v-model:draft 连接原 store 草稿；关闭和保存通过事件回到招聘入口，由 useCareersManagement 协调未保存确认和业务动作。

新闻 ArticleEditorDialog 和 CategoryEditorDialog 各自承载完整编辑弹窗，v-model:draft 连接 news store 的同一草稿，不复制、不请求；保存、确认、预览和关闭事件由 NewsModule 接入 useNewsManagement。弹窗专属样式随各组件维护。

site/NavigationTree 仅维护筛选和折叠，导航行由 utils/admin/site-settings/navigation-rows 投影；显隐通过事件交给 site-settings store，store 校验权限和当前草稿列表归属，不由展示组件修改传入对象。

领域控件就近归属：账号初始密码字段放在 users/InitialPasswordField，读取会话密码策略并复用 common/PasswordField；官网链接目标选择放在 website/shared/LinkTargetSelect，由调用方传入目标投影及加载状态，不绑定业务 store。common 仅保留基础展示和交互组件。

模板目录的适用页面说明消费接口返回的 applicablePages 投影，不从后台导航 URL 或预览样例推断；页面装配仍依据模板 allowedPages 校验。分类来自模板 category，两者相互独立。

后台组件只服务管理端，不引用 `components/public` 中的官网页面 Section。

## 网站维护领域

`website/pages` 负责页面设置、区块装配与内容编辑；`website/site` 负责网站标识、页头和页脚；`website/shared` 仅放这两类编辑器共同使用的状态栏和发布历史表格。页面和公共配置不能互相依赖对方的组件或 Store，领域共用组件不能反向依赖两类编辑器或其业务 Store。媒体选择器位于 admin/media，可消费共用的 media-selection Store。

导航编辑和目标标签工具放在 `utils/admin/site-settings`；模板字段工具放在 `utils/admin/website`。两类编辑器的共用样式放在 `assets/admin/css/components/website-editor.css`，不借用某一业务页面的样式入口。网站维护的领域组件不放入 `admin/common`。

## 公共展示合同

- `common/PageHeader.vue`：页面标题、说明、返回入口与主动作。
- `common/Feedback.vue`：信息、成功、警告、错误反馈及可选操作。
- `common/DataState.vue`：加载、失败和空数据三态，调用方必须分开表达。
- `common/Table.vue`：传入稳定最小宽度与无障碍名称，由容器负责内部横向滚动。
- `common/Dialog.vue`：单一标题、统一 footer、busy 状态禁止关闭。

公共组件只提供稳定展示和交互，不读取业务 URL、不调用 API、不承载账号/RBAC/参数/字典规则。按钮统一使用 `admin-button`、`admin-button-primary`、`admin-button-danger` 或 `admin-button-quiet`；新增/保存为主操作，刷新/返回/行内查看为低强调，删除/重置密码为危险操作。页面模块负责选择语义，公共样式不推断业务动作。

`common/Dialog.vue` 的 footer 样式与组件模板放在同一 SFC 作用域。导航图标消费服务端导航投影的 iconKey，通过 common/MenuIcon 消费 config/admin/menu-icons.ts 的 Lucide 映射；保留可读名称、原生提示和当前区段状态。

导航框架通过 `Frame.vue` 的 `expandedLogo`、`collapsedLogo` props 接收展开和折叠 Logo。桌面侧栏宽度切换和移动端抽屉是两种独立交互；移动端不把桌面折叠偏好解释为图标模式。新增页面只需维护菜单目录和图标映射，不得在页面内重复实现顶层导航、用户菜单或刷新权限入口。

`common/StatusBadge.vue` 只提供 neutral/success/warning/danger 四种状态外观，文案及业务状态由调用方决定，状态不能只靠颜色传递。账号页面视觉编排维护于 `app/assets/admin/css/pages/users.css`，规则限定在后台 `.account-page` 下；个人资料复用既有账号字段与外观，其他模块不通过引用该样式获取公共组件外观。

基础展示与通用交互统一放在 [common](common/README.md)，自动注册名称为 AdminCommon 前缀。认证表单位于 auth/Form.vue；业务专属区块和弹窗留在所属目录。

业务 Module 负责装配；业务状态、异步动作和资源生命周期放在 `stores/admin`，请求使用 `api/admin` 适配器。组件直接使用 store 或明确 props/events，不通过同名 composable 再代理一层，也不重复请求、复制草稿或创建轮询。Frame 在共同祖先提供刷新注册表；导航状态与偏好分别维护，Sidebar、Topbar、UserMenu 展示同一作用域状态。

任务组件只处理确认、可见性和轮询进入/离开接线；计时器及业务请求归 tasks store。日志详情组件直接消费 logs store，只在本地维护焦点、复制反馈和技术区展开。个人资料直接消费 users store 的 personal 分区。认证表单继续本地持有秘密输入。

账号列表与编辑的模块入口分别通过 `callOnce` 通知 `admin-users` store 进入；页面负责 URL 查询、路由变化、未保存确认和通知展示，store 负责业务请求、响应竞争、草稿与清理。创建和重置密码只在对应弹窗持有秘密输入，提交时作为 action 参数传入。

组件中的静态目录归 config/admin：菜单图标映射、任务计数名称、日志日期选项、重复启停筛选与 Toast 时长。Toast 直接使用 types/admin/interaction.ts 的通知类型。账号部门/岗位的历史选项转换归 utils/admin/users/profile-options.ts。简单 props/events 和仅组件内部使用的字段类型仍可就近定义，不逐项建立无实际作用的包装类型。

认证页通过 auth/Panel 统一品牌、标题和卡片外观，auth/Form 继续处理现有表单交互；页面入口仅装配与声明元信息。navigation/ForbiddenState 提供无权限状态和明确的首页返回，不使用历史返回避免再次进入拒绝入口；权限与认证守卫不变。

网站维护组件按业务分为 website/pages、website/site、website/shared。各领域 MaintenanceModule 装配表单、专属操作和历史详情，website/shared/MaintenanceFrame 协调共用流程；pages/SettingsContent 组合 SettingsForm 和 SectionAssembly，site/SettingsContent 组合网站标识、页头、页脚字段。pages/SectionModule 为独立区块内容入口，通过 SectionContentEditor 统一组合通用配置编辑器。FooterForm、NavigationTree、NavigationDialog、LinkFields、ReleaseDetails 分别负责完整表单、导航树、编辑弹窗、链接字段和历史详情。Module 表示路由业务入口，Form/Fields 表示编辑字段，Dialog 表示完整弹窗，其余按具体职责命名。跨网站维护领域共用的状态栏和历史表格放在 shared；基础控件放在 common，媒体选择放在 media。

子组件消费所属 Store 的同一草稿，不复制草稿；需要历史详情的组件通过所属 Store 管理请求。website composables 协调确认、通知和操作窗口状态；模块保留路由/会话生命周期、刷新注册、未保存保护、标题及组件组合。MaintenanceFrame 直接装配发布记录、发布、保存及下线按钮，维护适配器计算业务可用条件。区块入口只提供“保存区块草稿”，整页发布统一放在页面管理。布局样式集中在 website-editor.css，并限定作用容器。

网站导航与区块装配统一使用 common/TreeListEditor 的标题、数量、查询筛选、表格、空状态与说明，以及 common/Dialog 的编辑弹窗。业务只提供行数据、字段插槽和事件。新增区块在弹窗确认后由 website-pages Store 写入草稿；取消不影响草稿，未确认输入参与离开保护。栏目装配拆成“栏目管理”和“区块装配”两张表：前者在表格单选列维护默认栏目、Hero 模板、栏目显隐和顺序；后者只维护正文区块的模板、所属栏目、组内顺序和显隐。栏目的“编辑”复用 `/sections/:id` 页面编辑该栏目 Hero 和栏目名称；正文编辑继续使用同一路由。区块在每个栏目内强制连续排序，新增正文区块必须归属栏目。

网站标识、页头、页脚、页面管理、路由和语言入口分别挂载所属领域 MaintenanceModule，再通过插槽组合 website/shared/MaintenanceFrame；不保留中央业务登记表。维护适配器提供统一状态及操作接口。加载、刷新、离开保护、通知确认、保存发布和历史窗口只有一份流程。pages/SettingsContent 与 site/SettingsContent 只组合业务字段和特殊操作；区块内容仍由 pages/SectionModule 独立维护。

统一维护入口还拥有唯一 maintenance-content 布局容器：业务 SettingsContent 不再套 fieldset。该容器显式覆盖 controls.css 的默认 fieldset 边框、内边距和外边距，以 32px 网格间距装配同级卡片及列表；页面设置使用 site-card/site-fields，与公共配置共享表单布局。业务字段自行提供只读禁用状态。

侧栏网页菜单直接链接页面管理，不再派生“页面管理”或区块子菜单。区块从装配列表进入；导航按页面路径前缀高亮所属网页，SectionModule 用 useAdminDetailLabel 提供区块名称用于面包屑。区块路由和服务端权限校验独立保留。

区块内容页仅负责保存区块草稿和编辑期间的保护，不展示或调用发布、下线、发布历史和恢复操作，也不创建整页操作 composable。整页发布管理由 pages/MaintenanceModule 接入共用框架提供。

区块内容页保持独立字段卡片、媒体卡片和顶部保存布局，使用共用 EditorToolbar 展示草稿与语言状态，PageHeader 的返回入口通过 BackLink 返回页面管理。

新增栏目直接使用 common/Dialog，由同一装配编辑状态区分栏目与区块。填写中文栏目名称并明确选择横幅样式后，确认时一次性创建栏目及横幅草稿；取消不改变页面数据，未确认输入复用离开保护。界面统一使用“横幅样式”“顶部横幅”，选择器直接显示管理中设定的名称，不添加页面来源或用途前缀，内部模板键保持不变。

区块内容通过 pages/SectionContentEditor 选择编辑器：所有模板配置统一复用 pages/editors/SectionFormEditor 和 SectionFormFields；组织架构使用 about-structure 配置层级表格和节点弹窗，各层内容可新增、排序和调整上级。布局配置位于数据库模板修订的 editor 字段，纯内容操作位于 utils/admin/website，编辑组件类型位于 types/admin/website-section-editors 与 website-section-forms，数据库布局类型位于 shared/types/website/section-form。组件只维护本地交互，横幅切换后的草稿重建由 website-pages Store 完成，保存继续使用原接口。


网站编辑组件按职责归位：文本输入使用 common/TextField，标签开关行使用 common/SwitchField 的 row 布局，媒体选择与上传使用 media/Picker。公共保存、发布及历史按钮放在 MaintenanceFrame，专属预览和新建按钮放在所属 MaintenanceModule；导航和区块新增弹窗直接使用 common/Dialog，权限、fieldset、错误与确认行为由各入口维护。企业介绍横幅与首页经营数据均使用独立模板配置和通用区块编辑器；组织架构同样通过 about-structure 配置层级表格和节点字段。历史整页预览复用 PreviewDialog、WebsitePagePreview 与官网区块装配，回滚入口位于预览内部；不再维护第二套 schema 编辑器，未配置编辑入口的模板明确提示维护人员。

页面维护补充：TemplatesModule 承载模板资料界面，website-templates 路由只装配。页面 Store 在区块进入时明确初始化实际编辑草稿；SectionFormEditor 直接展示 modelValue，不在 computed 中补字段。纯装配及初始化操作位于 utils/admin/website/page-assembly，操作结果类型位于 types/admin/website-page-actions。公共维护适配器不提供空下线操作，字段与详情 props 使用明确类型。
