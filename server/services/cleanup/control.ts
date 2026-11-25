// 清理批次的取消、租约和进度控制合同，不依赖任务运行入口。
import type {DatabaseTransaction} from '../../db/transaction'

export class TaskCancelled extends Error {
    constructor(readonly reason: 'STOPPED' | 'LEASE_LOST') {
        super(reason)
    }
}

export interface MaintenanceBatch {
    kind: string;
    deletedCount: number;
    limitReached: boolean;
    cutoff: string;
    retentionDays?: number
}

export interface MaintenanceControl {
    requestId: string

    beforeBatch(tx: DatabaseTransaction): Promise<void>

    committed(tx: DatabaseTransaction, batch: MaintenanceBatch): Promise<void>
}
