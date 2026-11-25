# Admin config

后台前端的静态展示配置，不持有响应式状态、不执行请求、不包含业务计算函数。

- dashboard.ts：首页指标名称、说明和跳转配置。
- logs.ts：日志页面说明、目标名称和日期范围选项。
- tasks.ts：任务执行状态颜色映射、计数名称及页面轮询间隔。
- navigation.ts：后台紧凑导航媒体查询。
- parameters.ts：参数组名称与说明。
- request.ts：错误码和冲突原因的受控提示文案。

前后端共用配置继续直接引用 shared/config/admin，例如分页选项；不在本目录复制或提供转导出。服务端权限、菜单和校验规则继续由现有 shared/后端合同维护。

账号分页偏好未加载时直接使用 shared/config/admin/pagination.ts 的 DEFAULT_ADMIN_PAGE_SIZE，不再维护前端私有副本。

- menu-icons.ts：共享菜单键对应的前端 Lucide 组件映射。
- list.ts：账号、角色和字典的启停筛选选项。
- interaction.ts：成功 Toast 自动关闭时长。

公司品牌标识统一读取 app/config/admin/brand.ts 的 companyBrand（name、logo、logoSrcSet、logoMark）。后台标题、认证页和导航只使用 Admin 品牌资源，官网继续使用 components/public 下的独立品牌组件，两端不共享 Logo 组件或资源路径。

- api.ts：后台 API 开发调试开关，随 Nuxt 开发模式自动启停。

区块编辑布局随数据库模板修订保存，不在 app/config 登记。没有专用布局的模板按数据库字段合同生成通用表单。
