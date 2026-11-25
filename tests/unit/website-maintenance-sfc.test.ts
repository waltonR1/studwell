// 直接编译真实 SFC，覆盖 vue-tsc 无法发现的 defineProps 宏类型解析限制。
import {readFileSync,existsSync} from 'node:fs'
import {resolve} from 'node:path'
import {parse,compileScript,registerTS} from '@vue/compiler-sfc'
import ts from 'typescript'
import {expect,it} from 'vitest'
registerTS(()=>ts)
it.each(['languages/SettingsContent','routes/SettingsContent','shared/MaintenanceFrame','languages/MaintenanceModule','routes/MaintenanceModule','pages/MaintenanceModule','site/MaintenanceModule'])('%s 的 props、插槽和模板可以被 Vue SFC 编译器解析',section=>{
 const filename=resolve('app/components/admin/website/'+section+'.vue')
 const {descriptor}=parse(readFileSync(filename,'utf8'),{filename})
 expect(()=>compileScript(descriptor,{id:'website-maintenance',inlineTemplate:true,fs:{fileExists:existsSync,readFile:path=>readFileSync(path,'utf8')}})).not.toThrow()
})
