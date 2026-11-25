// 按统一语言目录只读检查翻译合同和前端词条使用情况。
import {supportedLocales} from '../shared/config/site-languages.ts'
import {readFileSync,readdirSync,existsSync} from 'node:fs'
import {resolve,dirname,relative} from 'node:path'
import {fileURLToPath} from 'node:url'
import {parseArgs} from 'node:util'
import ts from 'typescript'
import {parse as parseSfc} from '@vue/compiler-sfc'
import {parse as parseTemplate} from '@vue/compiler-dom'

const root=fileURLToPath(new URL('../',import.meta.url))
const unknown=Symbol('unresolved')
export function flattenMessages(value,prefix=''){
 return Object.entries(value).flatMap(([key,item])=>typeof item==='string'?[[prefix+key,item]]:flattenMessages(item,prefix+key+'.'))
}
function files(directory){return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(resolve(directory,entry.name)):/\.(vue|ts|mjs)$/.test(entry.name)?[resolve(directory,entry.name)]:[])}
const ast=source=>ts.createSourceFile('source.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS)
const expression=source=>ast(`(${source})`).statements[0]?.expression

// Only evaluate static syntax. No frontend module or arbitrary function is executed.
function value(node,env){
 if(!node)return unknown
 if(ts.isParenthesizedExpression(node)||ts.isAsExpression(node)||ts.isSatisfiesExpression(node)||ts.isNonNullExpression(node))return value(node.expression,env)
 if(ts.isStringLiteralLike(node))return node.text
 if(ts.isNumericLiteral(node))return Number(node.text)
 if(node.kind===ts.SyntaxKind.TrueKeyword)return true
 if(node.kind===ts.SyntaxKind.FalseKeyword)return false
 if(ts.isIdentifier(node))return env[node.text]??unknown
 if(ts.isArrayLiteralExpression(node)){
  const result=[]
  for(const item of node.elements){
   if(ts.isSpreadElement(item)){const values=value(item.expression,env);if(!Array.isArray(values))return unknown;result.push(...values)}
   else result.push(value(item,env))
  }
  return result
 }
 if(ts.isObjectLiteralExpression(node))return Object.fromEntries(node.properties.filter(ts.isPropertyAssignment).map(item=>[item.name.text,value(item.initializer,env)]))
 if(ts.isPropertyAccessExpression(node)||ts.isElementAccessExpression(node)){
  const object=value(node.expression,env),key=ts.isPropertyAccessExpression(node)?node.name.text:value(node.argumentExpression,env)
  return object!==unknown&&object!=null?object[key]??unknown:unknown
 }
 if(ts.isPrefixUnaryExpression(node)&&node.operator===ts.SyntaxKind.ExclamationToken){const item=value(node.operand,env);return item===unknown?unknown:!item}
 if(ts.isBinaryExpression(node)){
  const left=value(node.left,env),right=value(node.right,env)
  if(left===unknown||right===unknown)return unknown
  if(node.operatorToken.kind===ts.SyntaxKind.PlusToken)return left+right
  if(node.operatorToken.kind===ts.SyntaxKind.EqualsEqualsEqualsToken)return left===right
  if(node.operatorToken.kind===ts.SyntaxKind.ExclamationEqualsEqualsToken)return left!==right
  if(node.operatorToken.kind===ts.SyntaxKind.AmpersandAmpersandToken)return left&&right
  if(node.operatorToken.kind===ts.SyntaxKind.BarBarToken)return left||right
 }
 if(ts.isConditionalExpression(node)){const test=value(node.condition,env);return test===unknown?unknown:value(test?node.whenTrue:node.whenFalse,env)}
 if(ts.isTemplateExpression(node)){
  let text=node.head.text
  for(const span of node.templateSpans){const item=value(span.expression,env);if(item===unknown)return unknown;text+=String(item)+span.literal.text}
  return text
 }
 if(ts.isCallExpression(node)){
  if(ts.isIdentifier(node.expression)&&node.expression.text==='computed'&&ts.isArrowFunction(node.arguments[0]))return {value:value(node.arguments[0].body,env)}
  if(ts.isPropertyAccessExpression(node.expression)){
   const receiver=value(node.expression.expression,env),callback=node.arguments[0]
   if(Array.isArray(receiver)&&ts.isArrowFunction(callback)){
    const run=(item,index)=>value(callback.body,{...env,[callback.parameters[0]?.name.text]:item,[callback.parameters[1]?.name.text]:index})
    if(node.expression.name.text==='map')return receiver.map(run)
    if(node.expression.name.text==='find')return receiver.find((item,index)=>run(item,index)===true)??unknown
   }
  }
 }
 return unknown
}

export function auditI18n(base=root){
 const locales=supportedLocales,messages=Object.fromEntries(locales.map(locale=>[locale,new Map(flattenMessages(JSON.parse(readFileSync(resolve(base,'i18n/locales',locale+'.json'),'utf8'))))]))
 // 目录首项仅作为词条结构的比较基准，与官网默认语言无关。
 const reference=messages[locales[0]]
 const keys=[...reference.keys()],used=new Map(),errors=[],unresolved=new Set(),cache=new Map()
 const record=(key,file,required=false)=>{
  if(typeof key!=='string')return
  if(reference.has(key)){if(!used.has(key))used.set(key,new Set());used.get(key).add(file)}
  else if(required)errors.push(`${file}: missing key ${key}`)
 }
 function environment(file,source,seeds={}){
  const env={...seeds},tree=ast(source)
  for(const statement of tree.statements){
   if(ts.isExportDeclaration(statement)&&statement.moduleSpecifier){
    const target=resolve(dirname(file),statement.moduleSpecifier.text+'.ts')
    if(existsSync(target)){
     if(!cache.has(target))cache.set(target,environment(target,readFileSync(target,'utf8')))
     const exports=cache.get(target)
     if(statement.exportClause)for(const binding of statement.exportClause.elements)env[binding.name.text]=exports[binding.propertyName?.text??binding.name.text]??unknown
     else Object.assign(env,exports)
    }
   }
   if(ts.isImportDeclaration(statement)&&statement.importClause&&!statement.importClause.isTypeOnly){
    const specifier=statement.moduleSpecifier.text
    const path=specifier.startsWith('~/')?resolve(base,'app',specifier.slice(2)):specifier.startsWith('#shared/')?resolve(base,'shared',specifier.slice(8)):specifier.startsWith('.')?resolve(dirname(file),specifier):null
    const target=path&&[path+'.ts',resolve(path,'index.ts')].find(existsSync)
    if(target&&(/[/\\](data|config|utils)[/\\]public[/\\]/.test(target)||/[/\\]shared[/\\]/.test(target))){
     if(!cache.has(target))cache.set(target,environment(target,readFileSync(target,'utf8')))
     for(const binding of statement.importClause.namedBindings?.elements??[])env[binding.name.text]=cache.get(target)[binding.propertyName?.text??binding.name.text]??unknown
    }
   }
   if(ts.isVariableStatement(statement))for(const declaration of statement.declarationList.declarations){
    if(ts.isIdentifier(declaration.name)){const result=value(declaration.initializer,env);if(result!==unknown)env[declaration.name.text]=result}
   }
  }
  return env
 }
 function consume(node,env,file){
  const result=value(node,env)
  if(typeof result==='string'){record(result,file,true);return}
  if(node&&ts.isConditionalExpression(node)){consume(node.whenTrue,env,file);consume(node.whenFalse,env,file);return}
  const text=node?.getText()??''
  // Forwarding helpers: their callers/data supply the concrete keys below.
  if(file==='app/composables/public/runtime/seo/usePageSeo.ts')return
  if(file==='app/components/public/runtime/layout/AppHeader.vue'&&text==='`${page}.${name}Section.label`'){
   for(const section of ['overview','certificates','shipping'])record(`export.${section}Section.label`,file,true)
   return
  }
  if(file==='app/components/public/runtime/layout/AppHeader.vue'&&text==='page.labelKey')return
  if(file==='app/components/public/runtime/search/SearchForm.vue'&&text==='`search.${error}`'||file==='app/composables/public/runtime/search/useSearchSection.ts'&&text==="'search.' + error.value"){
   for(const error of ['tooLong','invalid'])record('search.'+error,file,true)
   return
  }
  if(file==='app/components/public/runtime/search/ResultsSection.vue'&&text==='`search.types.${result.type}`'&&Array.isArray(env.SEARCH_TYPES)){
   for(const type of env.SEARCH_TYPES.filter(type=>type!=='all'))record('search.types.'+type,file,true)
   return
  }
  unresolved.add(file+': '+text)
 }
 function scan(tree,env,file){
  function visit(node,scope){
   if(ts.isStringLiteralLike(node))record(node.text,file)
   if(ts.isPropertyAssignment(node)&&/^(labelKey|summaryKey|unitKey)$/.test(node.name.text??''))consume(node.initializer,scope,file)
   if(ts.isCallExpression(node)){
    const name=ts.isIdentifier(node.expression)?node.expression.text:ts.isPropertyAccessExpression(node.expression)?node.expression.name.text:''
    // contentText reads already-localized published API copy, not a locale message.
    if(name==='contentText'){for(const argument of node.arguments.slice(1))visit(argument,scope);return}
    if(['t','$t','te'].includes(name))consume(node.arguments[0],scope,file)
    if(name==='usePageSeo'&&node.arguments.length>1)for(const argument of node.arguments)if(ts.isStringLiteralLike(argument))consume(argument,scope,file)
    if(name==='map'&&ts.isPropertyAccessExpression(node.expression)){
     const items=value(node.expression.expression,scope),callback=node.arguments[0]
     if(Array.isArray(items)&&ts.isArrowFunction(callback)){
      visit(node.expression,scope)
      items.forEach((item,index)=>visit(callback.body,{...scope,[callback.parameters[0]?.name.text]:item,[callback.parameters[1]?.name.text]:index}))
      return
     }
    }
   }
   ts.forEachChild(node,child=>visit(child,scope))
  }
  visit(tree,env)
 }
 function template(node,env,file){
  const loop=node.props?.find(prop=>prop.type===7&&prop.name==='for')
  if(loop){
   const match=loop.exp.content.match(/^\s*(?:\(([^)]+)\)|([\w$]+))\s+(?:in|of)\s+([\s\S]+)$/)
   const items=match&&value(expression(match[3]),env)
   if(Array.isArray(items)){
    const names=(match[1]??match[2]).split(',').map(name=>name.trim())
    for(const [index,item] of items.entries())template({...node,props:node.props.filter(prop=>prop!==loop)},{...env,[names[0]]:item,[names[1]]:index},file)
    return
   }
  }
  if(node.type===5)scan(ast(node.content.content),env,file)
  for(const prop of node.props??[])if(prop.type===7&&prop.exp&&prop.name!=='for')scan(ast(prop.exp.content),env,file)
  for(const child of node.children??[])template(child,env,file)
 }
 const paths=files(resolve(base,'app')).filter(file=>!relative(resolve(base,'app'),file).replaceAll('\\','/').split('/').includes('admin'))
 for(const path of paths){
  const file=relative(base,path).replaceAll('\\','/'),source=readFileSync(path,'utf8')
  const descriptor=path.endsWith('.vue')?parseSfc(source).descriptor:null
  const script=descriptor?[descriptor.script?.content,descriptor.scriptSetup?.content].filter(Boolean).join('\n'):source
  const seeds=[{}]
  if(['app/components/public/sections/common/TopicHero.vue','app/components/public/ui/ColumnNavigation.vue','app/components/public/sections/about/HeroSection.vue'].includes(file)){
   seeds.length=0
   for(const group of file==='app/components/public/sections/about/HeroSection.vue'?['about']:['about','investment','sustainability']){
    seeds.push({props:{group,slug:''},group})
   }
  }
  for(const seed of seeds){
   const env=environment(path,script,seed)
   scan(ast(script),env,file)
   const templateEnv=Object.fromEntries(Object.entries(env).map(([key,item])=>[key,item&&typeof item==='object'&&Object.keys(item).length===1&&'value'in item?item.value:item]))
   if(descriptor?.template)template(parseTemplate(descriptor.template.content),templateEnv,file)
  }
 }
 // Search's object paths intentionally index complete groups. They do not keep
 // obsolete UI fields alive; screen/data consumers determine unused candidates.
 for(const filename of ['scripts/generate-search-index.mjs']){
  const path=resolve(base,filename);if(existsSync(path))scan(ast(readFileSync(path,'utf8')),{},filename)
 }
 for(const locale of locales){
  const entries=messages[locale]
  for(const key of new Set([...keys,...entries.keys()])){
   if(!entries.has(key)||!reference.has(key)){errors.push(`${locale}: key structure differs at ${key}`);continue}
   const placeholders=text=>[...text.matchAll(/\{([\w]+)\}/g)].map(match=>match[1]).sort().join(',')
   if(placeholders(entries.get(key))!==placeholders(reference.get(key)))errors.push(`${locale}: interpolation differs at ${key}`)
   for(const link of entries.get(key).matchAll(/@(?:\.\w+)?:([\w.]+)/g))record(link[1],`i18n/locales/${locale}.json`,true)
  }
 }
 return {keys:keys.length,used,unused:keys.filter(key=>!used.has(key)),errors:[...new Set(errors)],unresolved:[...unresolved]}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {values}=parseArgs({options:{'allow-unused':{type:'boolean',default:false}}})
 const result=auditI18n()
 console.log(JSON.stringify({...result,used:result.used.size},null,2))
 if(result.errors.length||result.unresolved.length||!values['allow-unused']&&result.unused.length)process.exitCode=1
}
