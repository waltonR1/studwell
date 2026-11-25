// 入口自行选择数据来源，共用加载错误的展示方式。
export async function usePreviewRequest<T>(load:()=>Promise<T>,message:string){
 try{return {data:await load(),error:''}}
 catch{return {data:undefined,error:message}}
}
