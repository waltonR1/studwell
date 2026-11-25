import {readFileSync,readdirSync,existsSync} from 'node:fs'
import {resolve,dirname,relative} from 'node:path'
import ts from 'typescript'
import {expect,it} from 'vitest'
const root=resolve('shared')
const files=(directory:string):string[]=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(resolve(directory,entry.name)):entry.name.endsWith('.ts')?[resolve(directory,entry.name)]:[])
const name=(path:string)=>relative(root,path).replaceAll('\\','/')
const sources=files(root)
it('官网模板类型只依赖基础与公共类型',()=>{
 const templateTypes=readFileSync('shared/types/website/section-template.ts','utf8')
 expect(templateTypes).not.toMatch(/from\s+['"].*(config|utils|schemas|admin)\//)
})
it('公共共享模块不反向依赖后台，共享模块不依赖应用运行层',()=>{
 const violations:string[]=[]
 for(const file of sources){
  const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true)
  function visit(node:ts.Node){
   if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))check(node.moduleSpecifier.text)
   if(ts.isImportTypeNode(node)&&ts.isLiteralTypeNode(node.argument)&&ts.isStringLiteral(node.argument.literal))check(node.argument.literal.text)
   if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0]))check(node.arguments[0].text)
   ts.forEachChild(node,visit)
  }
  function check(specifier:string){
   const target=specifier.startsWith('.')?resolve(dirname(file),specifier):specifier.startsWith('#shared/')?resolve(root,specifier.slice(8)):null
   if(!target){if(/^(~\/|#server|#imports|@\/)/.test(specifier))violations.push(name(file)+' -> '+specifier);return}
   const path=name(target)
   if(path.startsWith('../'))violations.push(name(file)+' -> outside shared: '+specifier)
   if(!name(file).split('/').includes('admin')&&path.split('/').includes('admin'))violations.push(name(file)+' -> admin: '+specifier)
   if(!existsSync(target)&&!existsSync(target+'.ts'))violations.push(name(file)+' -> missing: '+specifier)
  }
  visit(source)
 }
 expect(violations).toEqual([])
})
it('types 目录只导出类型，不混入运行时值',()=>{
 const violations:string[]=[]
 for(const file of sources.filter(file=>name(file).startsWith('types/'))){
  const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true)
  for(const statement of source.statements){
   if(ts.isImportDeclaration(statement)&&!statement.importClause?.isTypeOnly)violations.push(name(file)+' -> runtime import')
   else if(ts.isExportDeclaration(statement)&&!statement.isTypeOnly)violations.push(name(file)+' -> runtime export')
   else if(!ts.isImportDeclaration(statement)&&!ts.isExportDeclaration(statement)&&!ts.isInterfaceDeclaration(statement)&&!ts.isTypeAliasDeclaration(statement)&&!ts.isEmptyStatement(statement))violations.push(name(file)+' -> runtime declaration')
  }
 }
 expect(violations).toEqual([])
})
