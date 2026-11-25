import {readdirSync, readFileSync, existsSync} from 'node:fs'
import {resolve, dirname, relative} from 'node:path'
import ts from 'typescript'
import {describe, expect, it} from 'vitest'

const root = resolve('server')
function files(directory: string): string[] {
    return readdirSync(directory, {withFileTypes: true}).flatMap(item => item.isDirectory()
        ? files(resolve(directory, item.name)) : item.name.endsWith('.ts') ? [resolve(directory, item.name)] : [])
}
const sources = files(root)
const name = (path: string) => relative(root, path).replaceAll('\\', '/')
function imports(file: string) {
    const ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
    return ast.statements.flatMap(statement => (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement))
        && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier) ? [statement.moduleSpecifier.text] : [])
}
function target(file: string, specifier: string) {
    const base = specifier.startsWith('.') ? resolve(dirname(file), specifier)
        : specifier.startsWith('#server/') ? resolve(root, specifier.slice(8)) : null
    return base && [base, base + '.ts', resolve(base, 'index.ts')].find(path => path.endsWith('.ts') && existsSync(path))
}

describe('后端依赖边界', () => {
    it('运行时后端不从 app 前端目录获取业务目录', () => {
        const violations = sources.flatMap(file => imports(file).filter(specifier => {
            const resolved = specifier.startsWith('.') ? resolve(dirname(file), specifier) : ''
            return resolved.startsWith(resolve('app') + '/') || /^[~@]\//.test(specifier)
        }).map(specifier => `${name(file)} -> ${specifier}`))
        expect(violations).toEqual([])
    })
    it('业务和任务编排不依赖 HTTP 适配器，也不直接操作 ORM', () => {
        const violations = sources.filter(file => /^(services|tasks)\//.test(name(file))).flatMap(file =>
            imports(file).filter(specifier => /^(drizzle-orm|h3)(\/|$)/.test(specifier)
                || /http\/|runtime\/|db\/schema|db\/allocate-entity-id/.test(specifier))
                .map(specifier => `${name(file)} -> ${specifier}`))
        expect(violations).toEqual([])
    })
    it('HTTP 入口不直接依赖 Repository', () => {
        const violations = sources.filter(file => /^(http\/handlers|api|routes)\//.test(name(file))).flatMap(file =>
            imports(file).map(specifier => target(file, specifier)).filter((path): path is string => !!path)
                .filter(path => /^repositories\//.test(name(path)))
                .map(path => `${name(file)} -> ${name(path)}`))
        expect(violations).toEqual([])
    })
    it('持久化、基础契约和纯策略不能反向调用 Service、Handler 或运行入口', () => {
        const violations = sources.filter(file => /^(repositories|core|policies|config|schemas|infrastructure)\//.test(name(file))).flatMap(file =>
            imports(file).map(specifier => target(file, specifier)).filter((path): path is string => !!path)
                .filter(path => /^(services|tasks|api|http|runtime|middleware|plugins)\//.test(name(path)))
                .map(path => `${name(file)} -> ${name(path)}`))
        expect(violations).toEqual([])
    })
    it('HTTP 适配器不依赖运行装配入口，基础策略不依赖持久化实现', () => {
        const violations = sources.flatMap(file => imports(file).map(specifier => target(file, specifier))
            .filter((path): path is string => !!path)
            .filter(path => /^http\//.test(name(file)) && /^(runtime|api|middleware|plugins)\//.test(name(path))
                || /^(core|policies|config)\//.test(name(file)) && /^(repositories|db|infrastructure)\//.test(name(path)))
            .map(path => `${name(file)} -> ${name(path)}`))
        expect(violations).toEqual([])
    })
    it('运行期模块不能引用显式初始化或数据重建实现', () => {
        const violations = sources.flatMap(file => {
            const specifiers = imports(file)
            const ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
            function visit(node: ts.Node) {
                if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
                    && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) specifiers.push(node.arguments[0].text)
                ts.forEachChild(node, visit)
            }
            visit(ast)
            return specifiers.map(specifier => target(file, specifier)).filter((path): path is string => !!path)
                .filter(path => name(path).startsWith('../scripts/database/'))
                .map(path => `${name(file)} -> ${name(path)}`)
        })
        expect(violations).toEqual([])
    })
    it('业务服务不回调任务运行入口，静态配置不引用业务策略', () => {
        const violations = sources.flatMap(file => imports(file).map(specifier => target(file, specifier))
            .filter((path): path is string => !!path)
            .filter(path => /^services\//.test(name(file)) && /^(tasks|runtime|api|middleware|plugins|http)\//.test(name(path))
                || /^config\//.test(name(file)) && /^policies\//.test(name(path)))
            .map(path => `${name(file)} -> ${name(path)}`))
        expect(violations).toEqual([])
    })
    it('服务端本地模块之间不存在循环依赖（含类型和再导出）', () => {
        const graph = new Map(sources.map(file => [file, imports(file).map(specifier => target(file, specifier)).filter((path): path is string => !!path)]))
        const visited = new Set<string>(), active = new Set<string>(), cycles: string[] = []
        function visit(file: string, chain: string[]) {
            if (active.has(file)) { cycles.push([...chain, file].map(name).join(' -> ')); return }
            if (visited.has(file)) return
            active.add(file)
            for (const child of graph.get(file) ?? []) visit(child, [...chain, file])
            active.delete(file); visited.add(file)
        }
        for (const file of sources) visit(file, [])
        expect(cycles).toEqual([])
    })
})
