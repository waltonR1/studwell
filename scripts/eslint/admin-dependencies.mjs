// 后台目录依赖只能向下；同时解析别名和相对路径，覆盖静态、转导出与动态导入。
import path from 'node:path'

function appLayer(filename) {
  const normalized = filename.replaceAll('\\', '/')
  const relative = normalized.slice(normalized.lastIndexOf('/app/') + 5)
  const directory = relative.split('/')[0]
  if (directory === 'composables') return 1
  if (directory === 'stores') return 2
  if (directory === 'api') return 3
  if (['utils', 'config', 'types', 'assets'].includes(directory)) return 4
  return 0
}

export const adminDependenciesRule = {
  meta: {
    type: 'problem', schema: [],
    messages: {
      upward: '后台目录禁止反向依赖：页面/组件 → composables → stores → api → utils/config/types/shared。',
      implicit: '下层目录禁止通过自动导入调用后台 store/composable；请保持显式的单向依赖。',
      unresolved: '后台动态导入必须使用可检查的字符串路径，不能绕过目录依赖检查。',
    },
  },
  create(context) {
    const filename = context.filename.replaceAll('\\', '/')
    const appIndex = filename.lastIndexOf('/app/')
    if (appIndex < 0) return {}
    const appRoot = filename.slice(0, appIndex + 5)
    const sourceLayer = appLayer(filename)
    const importedNames = new Set(context.sourceCode.ast.body
      .filter(node => node.type === 'ImportDeclaration')
      .flatMap(node => node.specifiers.map(specifier => specifier.local.name)))
    function check(node, value) {
      if (typeof value !== 'string') return
      let target
      if (/^[~@]\//.test(value)) target = path.resolve(appRoot, value.slice(2))
      else if (/^(~~|@@)\/app\//.test(value)) target = path.resolve(appRoot, value.slice(7))
      else if (value.startsWith('.')) target = path.resolve(path.dirname(filename), value)
      else return
      const normalized = target.replaceAll('\\', '/')
      if (normalized.startsWith(appRoot) && appLayer(normalized) < sourceLayer)
        context.report({node, messageId: 'upward'})
    }
    return {
      ImportDeclaration(node) { check(node.source, node.source.value) },
      ExportNamedDeclaration(node) { if (node.source) check(node.source, node.source.value) },
      ExportAllDeclaration(node) { check(node.source, node.source.value) },
      ImportExpression(node) {
        if (typeof node.source.value !== 'string') context.report({node, messageId: 'unresolved'})
        else check(node.source, node.source.value)
      },
      CallExpression(node) {
        if (node.callee.type !== 'Identifier') return
        if (node.callee.name === 'require') {
          if (typeof node.arguments[0]?.value !== 'string') context.report({node, messageId: 'unresolved'})
          else check(node, node.arguments[0].value)
        }
        if (/^useAdmin[A-Z]/.test(node.callee.name)
          && (sourceLayer >= 3 || (sourceLayer === 2 && !importedNames.has(node.callee.name))))
          context.report({node, messageId: 'implicit'})
      },
    }
  },
}
