# Admin utilities

后台前端的计算、转换与校验工具，按职责和业务归档。官网工具独立维护在 `utils/public`。

| 目录 | 文件 | 职责 |
| --- | --- | --- |
| users | profile-options.ts | 部门/岗位选项及停用、历史值展示转换 |
| auth | password.ts、redirect.ts | 候选密码生成、后台返回地址校验 |
| request | errors.ts | 失败响应解析、受控提示、会话变化错误标识 |
| list | query.ts | URL 查询读取、草稿提交条件与分页参数构造 |
| menus | tree.ts、page-options.ts | 菜单祖先路径/隐藏状态、表单页面绑定选项 |
| roles | menu-selection.ts、permission-groups.ts、authorization.ts | 授权草稿同步、有效权限批选、菜单与权限关联计算 |
| dashboard | links.ts | 根据导航投影生成首页链接 |
| logs | presentation.ts | 日志来源、账号与系统维护身份展示 |

工具不读取 Vue/Nuxt 响应式状态，不调用业务 API、数据库或路由跳转，不保存业务草稿。密码生成是明确使用 Web Crypto 的工具；其余转换不访问浏览器环境。业务状态和生命周期归对应 store，DOM/路由接线归组件或 composable，请求路径归 api/admin。

静态展示配置归 config/admin，前端列表/失败信息/选择基线合同归 types/admin；工具直接引用，不转导出配置或类型作为兼容入口。函数内部临时类型、计算出的内部常量仍可就地声明。分页选项直接复用 shared/config/admin/pagination，不在前端复制一份。

此处的权限与菜单计算只辅助前端展示和编辑，最终授权由服务端裁决。密码生成不代替服务端密码策略校验；安全返回地址校验不负责实际跳转。

跨端已有契约继续引用 shared，不复制或迁移后端规则。新增工具按实际职责放入对应目录，不为每个目录添加无实际作用的 index.ts 或在根目录保留兼容转发文件；移动时同步应用与测试引用。
