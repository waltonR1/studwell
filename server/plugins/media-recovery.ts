// 启动媒体删除恢复流程，业务恢复规则由服务层执行。
import {getDatabase} from '../db';
import {mediaStorage} from '../runtime/media';
import {recoverMediaDeletes} from '../services/media-recovery';
export default defineNitroPlugin(async () => {await recoverMediaDeletes(getDatabase(),mediaStorage());});
