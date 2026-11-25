// 当前公开语言的数据必须存在；不补空内容、不跨语言回退，也不改写快照。
import {ApiError} from '../core/errors'
export function requiredLocalized<T>(values:Record<string,T>,locale:string):T{
 const value=values[locale]
 if(value===undefined)throw new ApiError('INTERNAL_ERROR')
 return value
}
