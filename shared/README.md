# Shared 目录使用约定

本目录保存前后端共用的数据合同、运行时校验、协议常量和纯函数。这里不读取数据库、不处理 HTTP 或浏览器状态，也不保存具体站点内容、模板实例及组件映射。

## 先按职责，再按用途归类

| 目录 | 职责 |
| --- | --- |
| types | 仅类型声明与类型推导，不导出运行时常量或函数 |
| schemas | 输入、发布数据和协议的运行时校验，可同时导出推导类型 |
| config | 固定值域、边界、名称映射和协议常量，不放草稿构造函数 |
| utils | 无环境依赖的计算、构造、解析和类型守卫 |

每个职责目录下，admin 表示后台管理合同，public 表示官网公开接口投影，website 表示发布和渲染共用的官网领域合同。语言、实体、图片算法及 API 等跨领域基础文件保留在职责目录根部，不为减少文件数而混合职责。

依赖方向为：admin 可以组合 website、public 和基础合同；website、public 及基础合同不能反向依赖 admin。共享代码不能导入 app 或 server。类型文件允许 import type 引用 schema 或固定目录，不重复手写已有合同。移动文件后更新调用方，不保留旧路径转导出。

## 区块模板与后台编辑

- types/website/section-template.ts：公共字段、图片槽位和装配约束，不包含后台编辑布局。
- schemas/website/section-template.ts：公共模板及字段校验；schemas/website/section-content.ts 根据字段合同校验正文。
- types/admin/section-form.ts、schemas/admin/section-form.ts：后台控件、分组、表格、选项和联动布局。
- types/admin/section-template.ts、schemas/admin/section-template.ts：组合公共模板、后台布局、预览元数据和组件代称的完整数据库修订合同。
- types/admin/website-preview.ts：后台预览及模板样例载荷，复用公开响应类型，不进入官网正式渲染依赖。

数据库保存具体模板定义、修订和规则，shared 定义它们的结构与合法边界。scripts/database 中的模板和图片描述仅用于初始安装；运行端读取数据库。图片基础规则和算法位于 types/image-presentation、schemas/image-presentation 和 utils/image-presentation；非区块模块的槽位集合位于 schemas/admin/image-rules。

## 官网路由与链接

路由、站点发布配置和链接目标类型位于 types/website；对应纯函数集中在 utils/website。route-tree 负责路由树校验，route-pattern 负责模式解析，site-link 和 link-target 负责地址生成与比较。路由节点类型放在 types/website/route，不从工具文件导出。

后台链接标签文案位于 utils/admin/link-target，站点设置空值工厂位于 utils/admin/site-settings；config/admin/site-settings 仅保留语言、分区和字段名称。后台 SEO 响应复用 types/website/site-config 的 SEO 字段，避免草稿和发布合同重复。

## 其他共享模块

搜索协议常量位于 config/website/search，搜索索引和清单类型位于 types/search。咨询转发占位符目录位于 config/admin/inquiry-forward-template，类型位于 types/admin/inquiry-forward-template，解释及预检函数位于 utils/admin/inquiry-forward-template。

API 错误目录位于 config/api-errors，响应类型位于 types/api。实体边界位于 schemas/entity 和 config/entity-versions。系统语言资源目录位于 config/site-languages；官网启用语言及默认语言由数据库发布配置控制。

任务、密码、分页、审计等管理模块分别归对应 admin 分区。任务调度执行、账号授权、邮件发送、数据库事务及发布编排属于 server；弹窗、响应式状态、浏览器事件、下载及视觉布局属于 app。

## 注释要求

每个 TS 文件以职责说明开头，注明输入数据或使用边界。仅在算法、约束或不直观行为处补充局部注释，不为每个字段重复类型名。目录变更同步更新本说明和调用路径。依赖方向和类型目录职责由 tests/unit/website-shared-boundaries.test.ts 检查。

语言维护的后台状态与写入合同分别位于 types/admin/site-languages 和 schemas/admin/site-languages；路由发布快照 types/website/site-config 不再携带语言配置。两者通过服务端发布校验关联，独立保存和回滚。
