// 恢复未完成的媒体删除操作，协调存储状态与数据库记录。
import type {Database} from '../db/transaction';
import type {MediaStorage} from '../core/media-storage';
import {mediaRepository} from '../repositories/media';
// 应在接收请求前运行；中断恢复依据数据库已提交结果，不猜测文件删除阶段。
export async function recoverMediaDeletes(database: Database, storage: MediaStorage) {
    for(const entry of await storage.staged()) {
        if(await mediaRepository.findByStorageKey(database,entry.key))await storage.restore(entry.token);
        else await storage.purge(entry.token);
    }
}
