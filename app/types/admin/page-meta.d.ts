// 后台路由显式声明区域；不以此元信息替代服务端认证或权限检查。
declare module '#app' {
    interface PageMeta {
        admin?: boolean
        adminPermission?: string | ((query: import('vue-router').LocationQuery) => string)
        adminTitle?: string
    }
}

export {}
