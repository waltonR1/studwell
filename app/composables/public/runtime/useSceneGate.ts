// 在官网外壳与区块之间共享场景入场的等待状态。
import {inject,provide,ref,type InjectionKey,type Ref} from 'vue'
const sceneGate:InjectionKey<Ref<boolean>>=Symbol('scene-entrance-gate')
export function provideSceneGate(pending:Ref<boolean>){provide(sceneGate,pending)}
export function useSceneGate(){return inject(sceneGate,ref(false))}
