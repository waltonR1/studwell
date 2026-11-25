// 存储端口由业务依赖，基础设施提供实现。
export interface MediaStorage {
    put(bytes: Buffer, extension: string): Promise<string>;
    read(key: string): Promise<Buffer>;
    range(key: string, start: number, end: number): Promise<Buffer>;
    stage(key: string): Promise<string>;
    restore(token: string): Promise<void>;
    purge(token: string): Promise<void>;
    staged(): Promise<Array<{token:string;key:string}>>;
    remove(key: string): Promise<void>;
}
