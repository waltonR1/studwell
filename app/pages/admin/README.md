# Admin pages

路由页负责元信息、权限声明、标题与模块装配。已接入认证、Dashboard、动态导航、账号、角色、菜单、参数、字典、日志、定时任务、个人资料、网站公共模块、网页装配及Section模板目录。

后台页面使用 `definePageMeta({ layout: 'admin', admin: true, middleware: 'admin' })` 和 `defineI18nRoute(false)`，按需声明 adminPermission，保持 `/admin/*` 不加官网语言前缀；管理界面仅中文。页面装配对应 `components/admin` 模块，业务状态及生命周期归 `stores/admin`，路由和页面环境接线归 `composables/admin`，请求路径归 `api/admin`。

前端守卫服务于访问体验；服务端 API 仍独立校验 Session、RBAC 和写操作 CSRF。网页维护提供设置、Section 编辑及对象独立发布；产品目录已支持分类及子区块维护，首页产品推荐独立维护推荐条目；官网读取方式保持原样。

路由文件按实际层级组织：只有单个入口的任务、菜单、参数和字典使用同名 .vue 文件，不创建仅含 index.vue 的目录；账号、角色保留 index.vue 和 [id].vue 的业务目录，日志按分类、网页维护按动态编码及Section实例保留目录。后台首页使用 admin/index.vue。文件整理不改变既有 URL、权限声明或模块装配。
