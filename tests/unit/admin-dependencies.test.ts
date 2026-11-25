import {describe, expect, it} from 'vitest'
import {Linter} from 'eslint'
import path from 'node:path'
import {readFileSync, readdirSync} from 'node:fs'
import ts from 'typescript'
import {adminDependenciesRule} from '../../scripts/eslint/admin-dependencies.mjs'

function violations(code: string, filename: string) {
    return new Linter().verify(code, [{files: ['**/*.js'],
        plugins: {architecture: {rules: {dependencies: adminDependenciesRule}}},
        rules: {'architecture/dependencies': 'error'},
    }], {filename: path.resolve(filename)})
}

describe('后台目录依赖边界', () => {
    it.each([
        ['app/stores/admin/example.js', "import x from '~/composables/admin/example'"],
        ['app/stores/admin/example.js', "import x from '../../composables/admin/example'"],
        ['app/api/admin/example.js', "export {x} from '~/stores/admin/session'"],
        ['app/api/admin/example.js', "export * from '../../stores/admin/session'"],
        ['app/utils/admin/example.js', "const api = import('~/api/admin/users')"],
        ['app/api/admin/example.js', "const store = useAdminSessionStore()"],
        ['app/api/admin/example.js', "import x from '~~/app/stores/admin/session'"],
        ['app/stores/admin/example.js', "const store = useAdminSessionStore()"],
        ['app/api/admin/example.js', "const api = import(modulePath)"],
    ])('拒绝反向依赖：%s %s', (filename, code) => {
        expect(violations(code, filename)).toHaveLength(1)
    })
    it('允许上层复用下层和 Nuxt 的基础请求能力', () => {
        expect(violations("import x from '~/api/admin/users'; import y from './session'", 'app/stores/admin/example.js')).toEqual([])
        expect(violations("import x from '~/utils/admin/request/errors'; const fetcher = useRequestFetch()", 'app/api/admin/example.js')).toEqual([])
    })
    it('后台实际运行时导入图不存在环，包括同层 store 的间接依赖', () => {
        const root = path.resolve('app')
        const files: string[] = []
        function walk(directory: string) {
            for (const entry of readdirSync(directory, {withFileTypes: true})) {
                const filename = path.join(directory, entry.name)
                if (entry.isDirectory()) walk(filename)
                else if (/\.(ts|vue)$/.test(filename) && !filename.endsWith('.d.ts')) files.push(filename)
            }
        }
        walk(root)
        const known = new Set(files), graph = new Map<string, string[]>()
        for (const filename of files) {
            let source = readFileSync(filename, 'utf8')
            if (filename.endsWith('.vue')) source = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]).join('\n')
            const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true)
            const edges: string[] = []
            function add(value: string) {
                const candidate = /^[~@]\//.test(value) ? path.resolve(root, value.slice(2))
                    : /^(~~|@@)\/app\//.test(value) ? path.resolve(root, value.slice(7))
                        : value.startsWith('.') ? path.resolve(path.dirname(filename), value) : null
                if (!candidate) return
                const target = [candidate, `${candidate}.ts`, `${candidate}.vue`, path.join(candidate, 'index.ts')].find(file => known.has(file))
                if (target) edges.push(target)
            }
            function visit(node: ts.Node) {
                if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
                    const typeOnly = ts.isImportDeclaration(node) ? node.importClause?.isTypeOnly : node.isTypeOnly
                    if (!typeOnly) add(node.moduleSpecifier.text)
                }
                if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0]))
                    add(node.arguments[0].text)
                ts.forEachChild(node, visit)
            }
            visit(ast)
            graph.set(filename, edges)
        }
        const done = new Set<string>(), stack: string[] = []
        function check(filename: string) {
            if (stack.includes(filename)) throw new Error([...stack, filename].map(file => path.relative(root, file)).join(' → '))
            if (done.has(filename)) return
            stack.push(filename)
            for (const dependency of graph.get(filename) ?? []) check(dependency)
            stack.pop()
            done.add(filename)
        }
        for (const filename of files.filter(file => /[\\/]admin[\\/]/.test(file))) check(filename)
    })
})
