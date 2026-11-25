# Admin types

后台界面专用类型：路由元信息扩展及账号非敏感创建草稿。跨端接口契约继续引用 `shared/types/admin`，不复制到此目录；对外命名交互契约归本目录，内部临时结构和状态推导可留在所属业务 store 或组件中，不建立 Context 注入层。

- api.ts：后台传输客户端接口和 CSV 文件结果。
- api-inputs.ts：从共享 schema 推导的后台 API 适配输入类型，不重复声明字段。
- action-result.ts：Store 返回的业务操作结果，不依赖 Toast 或组件。
- dashboard.ts：仪表盘指标展示与跳转配置类型。
- list.ts：列表 URL 状态、筛选草稿、提交动作、查询构造和 composable 接线参数。
- interaction.ts：页面确认框与 Toast 的交互类型。
- refresh.ts：页面刷新注册目标与注册表类型。
- request.ts：前端解析后的受控失败信息。
- roles.ts：角色菜单选择草稿、服务端基线及反馈、查询、列表动作结果。
- menus.ts、dictionaries.ts、parameters.ts、logs.ts：对应业务的反馈或查询类型。
- tasks.ts：任务编辑草稿。
- session.ts、notice.ts、navigation.ts：认证恢复、请求横幅、导航加载上下文和详情文案类型。
- users.ts：账号非敏感创建草稿、触碰字段、编辑分区、查询及动作结果。
- page-meta.d.ts：后台路由元信息扩展。

工具和 store 对外暴露的命名数据合同统一从本目录导入，不经 utils 转导出。仅服务函数内部实现的临时结构可保留内联；类型文件不承载配置值或运行时逻辑。

跨端契约直接引用 shared，不在此处建立第二份服务端模型。
