# 后台通用交互组件

仅用于管理后台，不引用官网组件，不包含 API、RBAC、业务 URL 或实体保存逻辑。

| 组件 | 责任 |
| --- | --- |
| PageHeader | 标题、说明与主动作装配 |
| Feedback | 信息、警告与错误展示，不推断业务动作 |
| DataState | 明确区分加载、失败与空数据 |
| Table | 表格容器、内部横向滚动与无障碍名称 |
| Dialog | 统一弹窗标题、footer 与 busy 关闭约束 |
| StatusBadge | 状态外观，具体文案和权限由业务决定 |
| BackLink | 返回入口的链接样式与点击区域 |
| DraftBadge | 未保存状态外观，dirty 仍由业务表单计算 |
| RowActions | 表格行内按钮，data-tone="danger" 表示危险操作，不决定权限 |
| Toast | 顶部居中通知，成功自动关闭，错误/警告手动关闭 |
| ConfirmDialog | 标题、后果、确认/取消按钮；由调用方决定动作 |
| SelectField | 字符串选项、空值、等宽下拉、禁用及 change 事件 |
| SwitchField | 布尔值与无障碍状态，支持 inline 默认布局和 row 标签行布局；不自动保存、不弹确认 |
| TextField | 标签、单行或多行文本及关联说明；不包含业务默认值或校验规则 |
| TreeListEditor | 组合树列表工具栏、表格与空状态；业务通过行数据、列插槽和事件接入 |
| PasswordField | 默认隐藏、点击显示/隐藏；每个字段独立，不保存密码；输入清空、提交禁用或组件卸载后不保留明文显示状态 |

Nuxt 自动注册名称带 `AdminCommon` 前缀，也可以显式 import。样式随组件维护，不依赖 `users.css`。密码输入继续复用已有 `admin-input`、`admin-button` 基础样式，后端校验和清空时机由业务表单负责；不得把密码写入 useState、持久存储或通知。

初始密码策略字段位于 `admin/users/InitialPasswordField.vue`，供创建与重置账号密码使用；官网链接目标选择位于 `admin/website/shared/LinkTargetSelect.vue`。两者包含领域合同，不属于基础通用控件。

状态配套在 `app/composables/admin/`，随机密码工具在 `app/utils/admin/auth/password.ts`。确认实例、Toast 实例均在页面创建，不跨账号或 SSR 请求共享。Layout 结构化确认请求也使用同一个 ConfirmDialog 渲染，登录/改密和个人资料离开确认不再维护另一套弹窗。


BackLink、DraftBadge、RowActions 供多个模块复用。页面容器由各模块管理，提取通用控件时保留业务表单的布局和交互。

操作反馈见[后台使用](../../../../docs/后台使用.md)：确认在执行前；成功结果 Toast；字段/表单错误就近展示；已保存但刷新失败使用持续警告。API 的 operationMessage 用于避免与全局会话/CSRF 恢复重复通知，message 仍用于加载状态说明。

Toast 消费 types/admin/interaction.ts 的 AdminToastNotification，自动关闭时长来自 config/admin/interaction.ts；MenuIcon 只负责按稳定键渲染，组件映射来自 config/admin/menu-icons.ts。

MenuTreeTable 统一菜单、公共导航及页面区块列表的排序、显隐状态和行操作。head/cells 提供业务字段。删除按钮统一使用“删除”，显隐开关的无障碍名称统一为“名称＋显示状态”。
