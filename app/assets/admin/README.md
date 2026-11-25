# Admin assets

后台专属样式，不覆盖官网样式。`css/foundation` 维护基础与滚动条，`css/components` 维护控件、表格、弹窗、共用工作区和树外观，`css/layout` 维护布局与导航，`css/pages` 维护模块专属外观。

`main.css` 是后台公共样式统一入口，由 admin 布局引入，依次加载基础、控件、表格、弹窗、布局、滚动条、工作区和树规则。原布局 scoped 规则改为显式后台容器作用域；根节点的 `data-admin-shell` 保留原有选择器权重，避免公共控件的层叠优先级变化。工作区规则限定后台模块容器；已确认相同的基础展示规则显式并列 admin-view-page 与 account-page 选择器，保留各自类名和权重，业务模块无需依赖授权类名。

账号、日志和字典样式继续保留各自业务作用域。角色授权样式只在角色页面引入；导航与任务区块分别以 scoped 加载对应局部样式，避免将业务样式全部加载到每个后台页面。

组件本身的稳定样式随组件维护。提取子区块时需显式维护 scoped/deep 边界、层叠顺序和移动端规则，不能仅移动模板后依赖父级 scope 属性。

字段错误 admin-field-error 归 components/controls.css；components/table.css 的原生 table/th/td 基础规则限定在 admin-table-wrap 内。日志局部规则以 :where(.admin-shell .log-page) 限定，保持原选择器权重；日志弹窗保留 portal=false，仍在模块容器内。角色页面统一使用 style src 按需引入专属样式。

任务文字、时间、触发标记和快照说明的相同规则位于 pages/task-common.css，各任务组件通过独立的 style scoped src 加载，再加载自身 scoped 样式；不通过 main.css 全局加载，也不依赖 CSS @import 继承 scoped。账号 users.css 与公共 workbench.css 已合并 16 组完全相同的基础规则（65 条重复声明），涵盖标题、按钮、输入框、头像和详情基础布局。仅将原选择器并列到相同公共规则，不改模板类名、权重、声明或媒体条件；账号特有卡片、动作、弹窗和响应式覆盖继续保留。其他相似规则不批量删除，跨选择器覆盖顺序及最终外观仍需浏览器视觉验收。

认证页外观位于 pages/auth.css，由 auth/Panel 以 scoped 加载；登录与改密共用品牌卡片，表单交互样式仍在 auth/Form。原 shell 中未再使用的 admin-auth-card 已移除。无权限页外观位于 pages/forbidden.css，由 navigation/ForbiddenState 以 scoped 加载；保留导航、仅展示目标路径，不显示查询参数和片段。
