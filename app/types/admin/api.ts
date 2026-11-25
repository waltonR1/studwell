// 后台前端传输接口与下载结果；不包含请求实现或业务状态。
export interface AdminCsvFile {
    blob: Blob
    filename: string
    count: number
}

export interface AdminApiClient {
    read<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T>
    mutate<T>(path: string, method: 'POST' | 'PUT' | 'DELETE', body: object): Promise<T>
    download(path: string, body: object): Promise<AdminCsvFile>
}


export interface AdminUploadClient extends AdminApiClient {
    upload<T>(path: string, file: File, query?: Record<string,string>, progress?: (value:number)=>void): Promise<T>
}
